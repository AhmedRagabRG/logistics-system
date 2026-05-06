import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { quoteUpdateSchema } from '@/lib/validation';
import { requireAdminSession } from '@/lib/admin-auth';
import { logPricingEvent } from '@/lib/audit';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function PUT(
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
    const parseResult = quoteUpdateSchema.safeParse(body);
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

    const data = parseResult.data;

    // Verify quote exists
    const [quoteRows] = await pool.execute<
      Array<RowDataPacket & { status: string }>
    >('SELECT status FROM quotes WHERE id = ? LIMIT 1', [quoteId]);

    if (!quoteRows || quoteRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Quote not found' } },
        { status: 404 }
      );
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.base_price !== undefined) { fields.push('base_price = ?'); values.push(data.base_price); }
    if (data.markup_percent !== undefined) { fields.push('markup_percent = ?'); values.push(data.markup_percent); }
    if (data.final_price !== undefined) { fields.push('final_price = ?'); values.push(data.final_price); }
    if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.handling_mode !== undefined) { fields.push('handling_mode = ?'); values.push(data.handling_mode); }
    if (data.rfq_id !== undefined) { fields.push('rfq_id = ?'); values.push(data.rfq_id); }
    if (data.review_reason !== undefined) { fields.push('review_reason = ?'); values.push(data.review_reason); }
    if (data.origin_region !== undefined) { fields.push('origin_region = ?'); values.push(data.origin_region); }
    if (data.destination_region !== undefined) { fields.push('destination_region = ?'); values.push(data.destination_region); }
    if (data.origin_postal_code !== undefined) { fields.push('origin_postal_code = ?'); values.push(data.origin_postal_code); }
    if (data.destination_postal_code !== undefined) { fields.push('destination_postal_code = ?'); values.push(data.destination_postal_code); }
    if (data.weight_kg !== undefined) { fields.push('weight_kg = ?'); values.push(data.weight_kg); }
    if (data.cargo_type !== undefined) { fields.push('cargo_type = ?'); values.push(data.cargo_type); }
    if (data.response_text !== undefined) { fields.push('response_text = ?'); values.push(data.response_text); }

    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    values.push(quoteId);
    await pool.execute<ResultSetHeader>(`UPDATE quotes SET ${fields.join(', ')} WHERE id = ?`, values);

    await logPricingEvent({
      event_type: 'quote_updated',
      quote_id: quoteId,
      admin_id: auth.admin.id,
      details: { updated_by: auth.admin.id, fields: Object.keys(data) },
    });

    return NextResponse.json({ success: true, data: { id: quoteId, updated: true } });
  } catch (error) {
    console.error('Quote update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update quote' } },
      { status: 500 }
    );
  }
}
