import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { quoteApproveSchema } from '@/lib/validation';
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
    const parseResult = quoteApproveSchema.safeParse(body);
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

    const { revised_price, notes, response_text } = parseResult.data;

    // Verify quote exists and is pending
    const [quoteRows] = await pool.execute<
      Array<RowDataPacket & { status: string; final_price: number; currency: string; rfq_id: number | null }>
    >('SELECT status, final_price, currency, rfq_id FROM quotes WHERE id = ? LIMIT 1', [quoteId]);

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

    // If quote has an RFQ and no revised_price provided, auto-populate from lowest vendor bid
    let finalPrice = revised_price ?? quote.final_price;
    let winningCurrency = quote.currency;

    if (quote.rfq_id && (!finalPrice || finalPrice <= 0)) {
      const [vendorRows] = await pool.execute<
        Array<RowDataPacket & { response_price: number; response_currency: string }>
      >(
        `SELECT response_price, response_currency
         FROM rfq_vendor_assignments
         WHERE rfq_id = (SELECT id FROM rfq_records WHERE quote_id = ?)
           AND status = 'responded'
           AND response_price IS NOT NULL
         ORDER BY response_price ASC
         LIMIT 1`,
        [quoteId]
      );

      if (vendorRows && vendorRows.length > 0) {
        finalPrice = vendorRows[0].response_price;
        winningCurrency = vendorRows[0].response_currency;
        console.log(`[APPROVE] Auto-populated from vendor bid: ${finalPrice} ${winningCurrency}`);
      }
    }

    // Block approval if still no valid price
    if (!finalPrice || finalPrice <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PRICE', message: 'Cannot approve with 0 price. Please enter a revised price or wait for vendor responses.' } },
        { status: 400 }
      );
    }

    // Fetch quote details for auto-response
    const [detailRows] = await pool.execute<
      Array<RowDataPacket & {
        origin_region: string;
        destination_region: string;
        language: string;
        is_oversize: boolean;
        customer_contact: string | null;
        channel: string;
      }>
    >(
      `SELECT q.origin_region, q.destination_region, s.language, q.is_oversize, s.customer_contact, s.channel
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
          final_price: finalPrice,
          currency: winningCurrency,
          language: (details.language as 'ar' | 'tr' | 'en') ?? 'en',
          status: 'approved',
          review_reason: notes ?? null,
          is_oversize: details.is_oversize,
        });
        autoResponseText = response.message;
      } catch (e) {
        console.error('Auto-response generation failed:', e);
      }
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE quotes SET status = 'approved', final_price = ?, currency = ?, review_reason = ?, response_text = ?, approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [finalPrice, winningCurrency, notes ?? null, autoResponseText, auth.admin.id, quoteId]
    );

    // Close any open RFQ linked to this quote (admin manually approved — no need for vendor bids)
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_records SET status = 'closed' WHERE quote_id = ? AND status IN ('open', 'responded')`,
      [quoteId]
    );

    // Send response to customer
    console.log(`[APPROVE] Preparing to send approval to customer. Channel: ${details?.channel}, Contact: ${details?.customer_contact}`);
    console.log(`[APPROVE] Response text: ${autoResponseText?.substring(0, 100)}...`);

    if (details?.customer_contact && autoResponseText) {
      const sendInput: Parameters<typeof sendMessage>[0] = {
        channel: details.channel as 'whatsapp' | 'telegram' | 'email',
        contactId: details.customer_contact,
        message: autoResponseText,
      };

      // WhatsApp approval notifications need a template fallback
      // if the 24h messaging window has closed
      if (details.channel === 'whatsapp') {
        console.log(`[APPROVE] WhatsApp detected. Will check 24h window first, then fallback to template if needed.`);
        sendInput.whatsappTemplate = {
          name: 'logistics_quote_approved',
          languageCode: 'en',
          bodyParameters: [
            details.origin_region,                        // {{1}} Origin
            details.destination_region,                   // {{2}} Destination
            `${finalPrice.toLocaleString('en-US')} ${winningCurrency}`, // {{3}} Price
          ],
        };
        console.log(`[APPROVE] Template params:`, sendInput.whatsappTemplate.bodyParameters);
      }

      console.log(`[APPROVE] Calling sendMessage...`);
      const sendResult = await sendMessage(sendInput);
      console.log(`[APPROVE] sendMessage result: success=${sendResult.success}, error=${sendResult.error || 'none'}`);

      await logPricingEvent({
        event_type: sendResult.success ? 'customer_approval_sent' : 'customer_approval_failed',
        quote_id: quoteId,
        admin_id: auth.admin.id,
        details: {
          channel: details.channel,
          contact: details.customer_contact,
          sent: sendResult.success,
          error: sendResult.error ?? null,
        },
      });
    } else {
      console.log(`[APPROVE] SKIPPED sending. customer_contact=${details?.customer_contact}, autoResponseText=${autoResponseText ? 'SET' : 'NULL'}`);
    }

    await logPricingEvent({
      event_type: 'quote_approved',
      quote_id: quoteId,
      admin_id: auth.admin.id,
      details: { revised_price: revised_price ?? null, notes: notes ?? null, response_text: autoResponseText },
    });

    return NextResponse.json({
      success: true,
      data: {
        quote_id: quoteId,
        status: 'approved',
        final_price: finalPrice,
        approved_at: new Date().toISOString(),
        response_text: autoResponseText,
      },
    });
  } catch (error) {
    console.error('Quote approve error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve quote' } },
      { status: 500 }
    );
  }
}
