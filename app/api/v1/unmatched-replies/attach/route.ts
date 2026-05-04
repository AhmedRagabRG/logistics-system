import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromCookie, validateSession } from '@/lib/session';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * POST /api/v1/unmatched-replies/attach
 * 
 * Attach an unmatched vendor reply to a specific RFQ.
 * This is used when a vendor forgets to include the RFQ reference in their reply.
 * 
 * Body: {
 *   unmatched_reply_id: number,
 *   rfq_reference: string   // e.g. "RFQ-20260504-001"
 * }
 */
export async function POST(request: NextRequest) {
  const token = await getSessionFromCookie();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await validateSession(token);
  if (!session.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.unmatched_reply_id !== 'number' || typeof body.rfq_reference !== 'string') {
    return NextResponse.json({ error: 'Bad request. Required: unmatched_reply_id (number), rfq_reference (string)' }, { status: 400 });
  }

  const { unmatched_reply_id, rfq_reference } = body;

  try {
    // 1. Get the unmatched reply
    const [replyRows] = await pool.execute<
      Array<RowDataPacket & {
        contact_id: string;
        reply_text: string;
        parsed_price: number | null;
        parsed_currency: string | null;
      }>
    >(
      'SELECT contact_id, reply_text, parsed_price, parsed_currency FROM unmatched_vendor_replies WHERE id = ? AND status = ?',
      [unmatched_reply_id, 'unmatched']
    );

    if (!replyRows || replyRows.length === 0) {
      return NextResponse.json({ error: 'Unmatched reply not found or already processed' }, { status: 404 });
    }

    const reply = replyRows[0];

    // 2. Find the RFQ by reference
    const [rfqRows] = await pool.execute<
      Array<RowDataPacket & { id: number; quote_id: number; status: string }>
    >(
      'SELECT id, quote_id, status FROM rfq_records WHERE rfq_reference = ? LIMIT 1',
      [rfq_reference]
    );

    if (!rfqRows || rfqRows.length === 0) {
      return NextResponse.json({ error: `RFQ not found: ${rfq_reference}` }, { status: 404 });
    }

    const rfq = rfqRows[0];

    if (rfq.status === 'closed') {
      return NextResponse.json({ error: 'RFQ is already closed' }, { status: 409 });
    }

    // 3. Find the vendor assignment for this RFQ matching the contact
    const [assignmentRows] = await pool.execute<
      Array<RowDataPacket & { id: number; vendor_id: number; contact_id: string }>
    >(
      `SELECT id, vendor_id, contact_id FROM rfq_vendor_assignments
       WHERE rfq_id = ?
       ORDER BY created_at DESC`,
      [rfq.id]
    );

    if (!assignmentRows || assignmentRows.length === 0) {
      return NextResponse.json({ error: 'No vendor assignments found for this RFQ' }, { status: 404 });
    }

    // Detect if reply contact is email
    const isEmail = reply.contact_id.includes('@');

    // Try to match by contact_id (normalized)
    let assignment = assignmentRows.find((a) => {
      if (isEmail) {
        return a.contact_id.toLowerCase() === reply.contact_id.toLowerCase();
      }
      const replyContactDigits = reply.contact_id.replace(/\D/g, '');
      const aDigits = a.contact_id.replace(/\D/g, '');
      return a.contact_id === reply.contact_id || aDigits === replyContactDigits;
    });

    // If no contact match and only one assignment, use it (admin confirmed)
    if (!assignment && assignmentRows.length === 1) {
      assignment = assignmentRows[0];
    }

    if (!assignment) {
      return NextResponse.json({
        error: 'Could not match vendor contact to any assignment. Multiple vendors found.',
        assignments: assignmentRows.map((a) => ({ vendor_id: a.vendor_id, contact_id: a.contact_id })),
      }, { status: 409 });
    }

    // 4. Extract price from reply (fallback to regex)
    let responsePrice = reply.parsed_price;
    let responseCurrency = reply.parsed_currency ?? 'TRY';

    if (!responsePrice) {
      const priceMatch = reply.reply_text.match(/(\d[\d.,]*\d)\s*(EUR|USD|TRY|GBP|€|\$|₺)?/i);
      if (priceMatch) {
        responsePrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        responseCurrency = priceMatch[2] ? priceMatch[2].toUpperCase() : 'TRY';
        if (responseCurrency === '€') responseCurrency = 'EUR';
        if (responseCurrency === '$') responseCurrency = 'USD';
        if (responseCurrency === '₺') responseCurrency = 'TRY';
      }
    }

    if (!responsePrice) {
      return NextResponse.json({ error: 'Could not extract price from reply text' }, { status: 400 });
    }

    // 5. Update the assignment with the vendor response
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_vendor_assignments
       SET response_price = ?, response_currency = ?, responded_at = NOW(), status = 'responded'
       WHERE id = ?`,
      [responsePrice, responseCurrency, assignment.id]
    );

    // 6. Mark the unmatched reply as resolved
    await pool.execute<ResultSetHeader>(
      `UPDATE unmatched_vendor_replies
       SET status = 'resolved', matched_rfq_id = ?, resolution_notes = ?, resolved_at = NOW()
       WHERE id = ?`,
      [rfq.id, `Manually attached to ${rfq_reference}`, unmatched_reply_id]
    );

    return NextResponse.json({
      success: true,
      data: {
        unmatched_reply_id,
        rfq_id: rfq.id,
        rfq_reference,
        vendor_id: assignment.vendor_id,
        price: responsePrice,
        currency: responseCurrency,
      },
    });
  } catch (error) {
    console.error('Attach unmatched reply error:', error);
    return NextResponse.json({ error: 'Failed to attach reply to RFQ' }, { status: 500 });
  }
}
