import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { rfqGenerateQuoteSchema } from '@/lib/validation';
import { requireAdminSession } from '@/lib/admin-auth';
import { logPricingEvent } from '@/lib/audit';
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

    const body = await request.json();
    const parseResult = rfqGenerateQuoteSchema.safeParse(body);
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

    const { selected_vendor_id, admin_margin_percent } = parseResult.data;

    // Get RFQ
    const [rfqRows] = await pool.execute<
      Array<RowDataPacket & { quote_id: number; status: string }>
    >('SELECT quote_id, status FROM rfq_records WHERE id = ? LIMIT 1', [rfqId]);

    if (!rfqRows || rfqRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'RFQ not found' } },
        { status: 404 }
      );
    }

    const rfq = rfqRows[0];

    // Get vendor response from assignments table
    const [assignmentRows] = await pool.execute<
      Array<RowDataPacket & { response_price: number; response_currency: string; status: string }>
    >(
      `SELECT response_price, response_currency, status
       FROM rfq_vendor_assignments
       WHERE rfq_id = ? AND vendor_id = ?
       LIMIT 1`,
      [rfqId, selected_vendor_id]
    );

    if (!assignmentRows || assignmentRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Selected vendor not found in RFQ' } },
        { status: 404 }
      );
    }

    const assignment = assignmentRows[0];
    if (assignment.status !== 'responded' || !assignment.response_price) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: 'Selected vendor has not responded yet' } },
        { status: 409 }
      );
    }

    // Use vendor's original price and currency (no exchange rate conversion)
    const vendorPrice = assignment.response_price;
    const vendorCurrency = assignment.response_currency;

    // Apply admin margin
    const margin = admin_margin_percent ?? 0;
    const finalPrice = vendorPrice * (1 + margin / 100);

    // Update quote with generated price (keep vendor's original currency)
    await pool.execute<ResultSetHeader>(
      `UPDATE quotes SET base_price = ?, markup_percent = ?, final_price = ?, currency = ?, status = 'ready_to_send' WHERE id = ?`,
      [vendorPrice, margin, finalPrice, vendorCurrency, rfq.quote_id]
    );

    // Update RFQ
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_records SET generated_quote_price = ?, status = 'closed' WHERE id = ?`,
      [finalPrice, rfqId]
    );

    await logPricingEvent({
      event_type: 'rfq_quote_generated',
      quote_id: rfq.quote_id,
      admin_id: auth.admin.id,
      details: { vendor_id: selected_vendor_id, vendor_price: vendorPrice, margin, final_price: finalPrice },
    });

    return NextResponse.json({
      success: true,
      data: {
        rfq_id: rfqId,
        quote_id: rfq.quote_id,
        vendor_price: vendorPrice,
        margin_percent: margin,
        final_price: finalPrice,
        currency: vendorCurrency,
        status: 'ready_to_send',
      },
    });
  } catch (error) {
    console.error('RFQ generate quote error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate quote from RFQ' } },
      { status: 500 }
    );
  }
}
