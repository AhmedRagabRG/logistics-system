import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { quoteRejectSchema } from '@/lib/validation';
import { logPricingEvent } from '@/lib/audit';
import { requireAdminSession } from '@/lib/admin-auth';
import { generateCustomerResponse } from '@/lib/openai';
import { sendMessage } from '@/lib/sender';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    const quoteId = parseInt(id, 10);
    if (isNaN(quoteId)) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid quote ID' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = quoteRejectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parseResult.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
        },
        { status: 400 }
      );
    }

    const { reason, response_text } = parseResult.data;

    // Verify quote exists and is pending
    const [quoteRows] = await pool.execute<
      Array<RowDataPacket & { status: string; final_price: number; currency: string }>
    >('SELECT status, final_price, currency FROM quotes WHERE id = ? LIMIT 1', [quoteId]);

    if (!quoteRows || quoteRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Quote not found' } },
        { status: 404 }
      );
    }

    const quote = quoteRows[0];
    if (quote.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_PROCESSED', message: 'Quote has already been approved or rejected' } },
        { status: 409 }
      );
    }

    // Fetch quote details for auto-response
    const [detailRows] = await pool.execute<
      Array<RowDataPacket & {
        origin_region: string;
        destination_region: string;
        language: string;
        is_oversize: boolean;
        is_dual_mode: boolean;
        sea_final_price: number;
        sea_currency: string;
        customer_contact: string | null;
        channel: string;
      }>
    >(
      `SELECT q.origin_region, q.destination_region, s.language, q.is_oversize, q.is_dual_mode, q.sea_final_price, q.sea_currency, s.customer_contact, s.channel
       FROM quotes q
       JOIN shipment_requests s ON s.id = q.shipment_request_id
       WHERE q.id = ?`,
      [quoteId]
    );
    const details = detailRows?.[0];

    // Auto-generate response text if not provided
    let autoResponseText = response_text ?? null;
    if (!autoResponseText && details) {
      try {
        const response = await generateCustomerResponse({
          quote_id: quoteId,
          origin_region: details.origin_region,
          destination_region: details.destination_region,
          final_price: quote.final_price,
          currency: quote.currency,
          sea_final_price: details.is_dual_mode ? details.sea_final_price : undefined,
          sea_currency: details.is_dual_mode ? details.sea_currency : undefined,
          is_dual_mode: details.is_dual_mode,
          language: (details.language as 'ar' | 'tr' | 'en') ?? 'en',
          status: 'rejected',
          review_reason: reason,
          is_oversize: details.is_oversize,
        });
        autoResponseText = response.message;
      } catch (e) {
        console.error('Auto-response generation failed:', e);
      }
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE quotes SET status = 'rejected', review_reason = ?, response_text = ?, approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [reason, autoResponseText, auth.admin.id, quoteId]
    );

    // Close any open RFQ linked to this quote (quote rejected — no need for vendor bids)
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_records SET status = 'closed' WHERE quote_id = ? AND status IN ('open', 'responded')`,
      [quoteId]
    );

    // Send response to customer
    if (details?.customer_contact && autoResponseText) {
      const sendInput: Parameters<typeof sendMessage>[0] = {
        channel: details.channel as 'whatsapp' | 'telegram' | 'email',
        contactId: details.customer_contact,
        message: autoResponseText,
      };

      // WhatsApp rejection notifications need a template fallback
      // if the 24h messaging window has closed
      if (details.channel === 'whatsapp') {
        sendInput.whatsappTemplate = {
          name: 'logistics_quote_rejected',
          languageCode: 'en',
          bodyParameters: [
            details.origin_region,          // {{1}} Origin
            details.destination_region,     // {{2}} Destination
            reason || 'Unable to provide quote at this time', // {{3}} Reason
          ],
        };
      }

      const sendResult = await sendMessage(sendInput);
      await logPricingEvent({
        event_type: sendResult.success ? 'customer_rejection_sent' : 'customer_rejection_failed',
        quote_id: quoteId,
        admin_id: auth.admin.id,
        details: {
          channel: details.channel,
          contact: details.customer_contact,
          sent: sendResult.success,
          error: sendResult.error ?? null,
        },
      });
    }

    await logPricingEvent({
      event_type: 'quote_rejected',
      quote_id: quoteId,
      admin_id: auth.admin.id,
      details: { reason, response_text: autoResponseText },
    });

    return NextResponse.json({
      success: true,
      data: {
        quote_id: quoteId,
        status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
        response_text: autoResponseText,
      },
    });
  } catch (error) {
    console.error('Quote reject error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reject quote' } },
      { status: 500 }
    );
  }
}
