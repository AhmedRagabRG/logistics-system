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
    if (assignment.status !== 'responded') {
      console.log(`[GENERATE-QUOTE] RFQ ${rfqId} vendor ${selected_vendor_id} status is '${assignment.status}', expected 'responded'`);
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: 'Selected vendor has not responded yet' } },
        { status: 409 }
      );
    }
    if (!assignment.response_price) {
      console.log(`[GENERATE-QUOTE] RFQ ${rfqId} vendor ${selected_vendor_id} has no response_price (value: ${assignment.response_price})`);
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: 'Selected vendor has not responded yet' } },
        { status: 409 }
      );
    }

    // Use vendor's original price and currency (no exchange rate conversion)
    const vendorPrice = typeof assignment.response_price === 'string' ? parseFloat(assignment.response_price) : assignment.response_price;
    const vendorCurrency = assignment.response_currency;

    // Determine margin: explicit admin margin > vendor-specific > global
    let margin = admin_margin_percent;
    let marginSource = 'admin';
    if (margin === undefined) {
      const [vendorMarginRows] = await pool.execute<
        Array<RowDataPacket & { use_custom_margin: number; margin_rate: number }>
      >(
        'SELECT use_custom_margin, margin_rate FROM vendors WHERE id = ? LIMIT 1',
        [selected_vendor_id]
      );
      const vm = vendorMarginRows?.[0];
      if (vm && vm.use_custom_margin === 1) {
        margin = vm.margin_rate;
        marginSource = 'vendor';
      } else {
        const [settingsRows] = await pool.execute<
          Array<RowDataPacket & { global_markup_percent: number }>
        >('SELECT global_markup_percent FROM system_settings ORDER BY id DESC LIMIT 1');
        margin = settingsRows?.[0]?.global_markup_percent ?? 0;
        marginSource = 'global';
      }
    }
    const finalPrice = vendorPrice * (1 + margin / 100);

    // Update quote with generated price (keep vendor's original currency)
    await pool.execute<ResultSetHeader>(
      `UPDATE quotes SET base_price = ?, markup_percent = ?, final_price = ?, currency = ?, status = 'ready_to_send' WHERE id = ?`,
      [vendorPrice, margin, finalPrice, vendorCurrency, rfq.quote_id]
    );

    // Update RFQ with selected vendor
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_records SET generated_quote_price = ?, selected_vendor_id = ?, status = 'closed' WHERE id = ?`,
      [finalPrice, selected_vendor_id, rfqId]
    );

    await logPricingEvent({
      event_type: 'rfq_quote_generated',
      quote_id: rfq.quote_id,
      admin_id: auth.admin.id,
      details: { vendor_id: selected_vendor_id, vendor_price: vendorPrice, margin, margin_source: marginSource, final_price: finalPrice },
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
