import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { rfqUpdateSchema } from '@/lib/validation';
import { logVendorEvent } from '@/lib/audit';
import { requireAdminSession } from '@/lib/admin-auth';
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
    const parseResult = rfqUpdateSchema.safeParse(body);
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

    const { vendor_responses } = parseResult.data;

    // Verify RFQ exists
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

    // Update vendor assignments with responses
    for (const response of vendor_responses) {
      await pool.execute<ResultSetHeader>(
        `UPDATE rfq_vendor_assignments
         SET response_price = ?, response_currency = ?, responded_at = NOW(), status = 'responded'
         WHERE rfq_id = ? AND vendor_id = ?`,
        [response.price, response.currency ?? null, rfqId, response.vendor_id]
      );
    }

    // Update RFQ status
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_records SET status = 'responded' WHERE id = ?`,
      [rfqId]
    );

    // Log each vendor response
    for (const response of vendor_responses) {
      await logVendorEvent({
        event_type: 'vendor_response_received',
        quote_id: rfq.quote_id,
        rfq_id: rfqId,
        vendor_id: response.vendor_id,
        details: { price: response.price, currency: response.currency },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        rfq_id: rfqId,
        status: 'responded',
        vendor_responses: vendor_responses,
      },
    });
  } catch (error) {
    console.error('RFQ update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update RFQ' } },
      { status: 500 }
    );
  }
}

export async function GET(
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

    const [rows] = await pool.execute<
      Array<
        RowDataPacket & {
          id: number;
          quote_id: number;
          rfq_reference: string;
          target_country: string;
          vendor_responses: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        }
      >
    >('SELECT * FROM rfq_records WHERE id = ? LIMIT 1', [rfqId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'RFQ not found' } },
        { status: 404 }
      );
    }

    const row = rows[0];

    // Fetch vendor assignments with vendor names
    const [assignmentRows] = await pool.execute<
      Array<
        RowDataPacket & {
          id: number;
          vendor_id: number;
          vendor_name: string;
          contact_channel: string;
          contact_id: string;
          response_price: number | null;
          response_currency: string | null;
          responded_at: string | null;
          status: string;
        }
      >
    >(
      `SELECT a.id, a.vendor_id, v.name as vendor_name, a.contact_channel, a.contact_id,
              a.response_price, a.response_currency, a.responded_at, a.status
       FROM rfq_vendor_assignments a
       JOIN vendors v ON v.id = a.vendor_id
       WHERE a.rfq_id = ?`,
      [rfqId]
    );

    const vendors = (assignmentRows || []).map((a) => ({
      id: a.id,
      vendor_id: a.vendor_id,
      vendor_name: a.vendor_name,
      contact_channel: a.contact_channel,
      contact_id: a.contact_id,
      response_price: a.response_price,
      response_currency: a.response_currency,
      responded_at: a.responded_at,
      status: a.status,
    }));

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        quote_id: row.quote_id,
        rfq_reference: row.rfq_reference,
        target_country: row.target_country,
        status: row.status,
        vendors,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (error) {
    console.error('RFQ get error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch RFQ' } },
      { status: 500 }
    );
  }
}
