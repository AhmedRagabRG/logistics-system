import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-auth';
import { logPricingEvent, logVendorEvent } from '@/lib/audit';
import { generateVendorMessage } from '@/lib/openai';
import { sendMessage, sendWhatsAppTemplate } from '@/lib/sender';
import { normalizeContactId } from '@/lib/messaging-window';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    const rfqId = parseInt(id, 10);
    if (isNaN(rfqId)) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid RFQ ID' } },
        { status: 404 }
      );
    }

    // Lock and verify RFQ is draft
    const [rfqRows] = await pool.execute<
      Array<RowDataPacket & {
        id: number;
        quote_id: number;
        rfq_reference: string;
        target_country: string;
        status: string;
        messages_sent: number;
      }>
    >(
      `SELECT id, quote_id, rfq_reference, target_country, status, messages_sent
       FROM rfq_records WHERE id = ? FOR UPDATE`,
      [rfqId]
    );

    if (!rfqRows || rfqRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'RFQ not found' } },
        { status: 404 }
      );
    }

    const rfq = rfqRows[0];
    if (rfq.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot send messages for RFQ with status '${rfq.status}'. Only draft RFQs are eligible.` } },
        { status: 409 }
      );
    }

    if (rfq.messages_sent) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_SENT', message: 'Messages have already been sent for this RFQ.' } },
        { status: 409 }
      );
    }

    // Get quote details
    const [quoteRows] = await pool.execute<
      Array<RowDataPacket & {
        origin_region: string;
        destination_region: string;
        weight_kg: number | null;
        cargo_type: string | null;
      }>
    >(
      `SELECT origin_region, destination_region, weight_kg, cargo_type
       FROM quotes WHERE id = ? LIMIT 1`,
      [rfq.quote_id]
    );
    const quote = quoteRows?.[0];
    if (!quote) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Associated quote not found' } },
        { status: 404 }
      );
    }

    // Get shipment request details for vendor messages
    const [shipmentRows] = await pool.execute<
      Array<RowDataPacket & { language: string; customer_name: string | null }>
    >(
      `SELECT s.language, s.customer_name
       FROM quotes q
       JOIN shipment_requests s ON s.id = q.shipment_request_id
       WHERE q.id = ?`,
      [rfq.quote_id]
    );
    const shipment = shipmentRows?.[0];
    const language = (shipment?.language as 'ar' | 'tr' | 'en') ?? 'en';

    // Get all vendor assignments for this RFQ
    const [assignmentRows] = await pool.execute<
      Array<RowDataPacket & {
        id: number;
        vendor_id: number;
        contact_channel: string;
        contact_id: string;
      }>
    >(
      `SELECT id, vendor_id, contact_channel, contact_id
       FROM rfq_vendor_assignments
       WHERE rfq_id = ? AND status = 'pending'`,
      [rfqId]
    );

    if (!assignmentRows || assignmentRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ASSIGNMENTS', message: 'No pending vendor assignments found for this RFQ.' } },
        { status: 400 }
      );
    }

    // Get vendor details for message generation
    const vendorIds = Array.from(new Set(assignmentRows.map(a => a.vendor_id)));
    const [vendorRows] = await pool.execute<
      Array<RowDataPacket & {
        id: number;
        name: string;
        contact_phone: string | null;
        contact_email: string | null;
        telegram_chat_id: string | null;
      }>
    >(
      `SELECT id, name, contact_phone, contact_email, telegram_chat_id
       FROM vendors WHERE id IN (${vendorIds.map(() => '?').join(',')})`,
      vendorIds
    );
    const vendorsMap = new Map(vendorRows.map(v => [v.id, v]));

    let messagesSent = 0;
    const failedAssignments: Array<{ assignment_id: number; vendor_id: number; error: string }> = [];

    for (const assignment of assignmentRows) {
      const vendor = vendorsMap.get(assignment.vendor_id);
      if (!vendor) continue;

      let contactId = assignment.contact_id;
      const contactChannel = assignment.contact_channel;

      if (contactChannel === 'whatsapp') {
        contactId = normalizeContactId(contactId, 'whatsapp');
      }

      let sendResult: { success: boolean; messageId?: string | number; error?: string };
      let sentMessage: string;

      if (contactChannel === 'whatsapp') {
        const templateParams = [
          vendor.name,
          String(quote.origin_region),
          String(quote.destination_region),
          `${(quote.weight_kg ?? 0).toLocaleString()} kg`,
          quote.cargo_type ?? 'General Cargo',
          rfq.rfq_reference,
        ];

        sendResult = await sendWhatsAppTemplate(
          contactId,
          'logistics_rfq_request',
          'en',
          templateParams
        );
        sentMessage = `[Template: logistics_rfq_request] ${templateParams.join(' | ')}`;
      } else {
        const msg = await generateVendorMessage({
          rfq_reference: rfq.rfq_reference,
          target_country: rfq.target_country,
          origin_region: String(quote.origin_region),
          destination_region: String(quote.destination_region),
          weight_kg: quote.weight_kg ?? 0,
          cargo_type: quote.cargo_type,
          vendor_name: vendor.name,
          language,
          channel: contactChannel as 'email' | 'whatsapp' | 'telegram',
        });
        sentMessage = msg.message;

        sendResult = await sendMessage({
          channel: contactChannel as 'whatsapp' | 'telegram' | 'email',
          contactId,
          message: msg.message,
          subject: msg.subject,
        });
      }

      if (sendResult.success) {
        messagesSent++;
      } else {
        failedAssignments.push({
          assignment_id: assignment.id,
          vendor_id: assignment.vendor_id,
          error: sendResult.error ?? 'Unknown error',
        });
      }

      await logVendorEvent({
        event_type: sendResult.success ? 'vendor_rfq_sent' : 'vendor_rfq_send_failed',
        quote_id: rfq.quote_id,
        rfq_id: rfqId,
        vendor_id: assignment.vendor_id,
        details: {
          rfq_reference: rfq.rfq_reference,
          channel: contactChannel,
          contact_id: contactId,
          message: sentMessage,
          sent: sendResult.success,
          error: sendResult.error ?? null,
        },
      });
    }

    // Update RFQ status
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_records SET status = 'open', messages_sent = 1 WHERE id = ?`,
      [rfqId]
    );

    // Update quote review_reason
    await pool.execute<ResultSetHeader>(
      `UPDATE quotes SET review_reason = ? WHERE id = ?`,
      [`RFQ ${rfq.rfq_reference} approved and messages sent to vendors.`, rfq.quote_id]
    );

    await logPricingEvent({
      event_type: 'rfq_initiated',
      quote_id: rfq.quote_id,
      rfq_id: rfqId,
      admin_id: auth.admin.id,
      details: {
        target_country: rfq.target_country,
        vendor_count: assignmentRows.length,
        messages_sent: messagesSent,
        failed_count: failedAssignments.length,
        rfq_reference: rfq.rfq_reference,
        source: 'manual_send_approved',
        mode: 'manual',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        rfq_id: rfqId,
        rfq_reference: rfq.rfq_reference,
        messages_sent: messagesSent,
        failed_count: failedAssignments.length,
        failed_assignments: failedAssignments,
        status: 'open',
      },
    });
  } catch (error) {
    console.error('Send RFQ messages error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send RFQ messages' } },
      { status: 500 }
    );
  }
}
