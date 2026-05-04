import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getRFQs } from '@/lib/db-queries';
import { rfqCreateSchema } from '@/lib/validation';
import pool from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10)));

    const data = await getRFQs({ status, fromDate, toDate, search, page, limit });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('RFQ list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch RFQs' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const parseResult = rfqCreateSchema.safeParse(body);
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

    const { quote_id, rfq_reference, target_country, vendors } = parseResult.data;

    // Verify quote exists
    const [quoteRows] = await pool.execute<
      Array<RowDataPacket & { id: number }>
    >('SELECT id FROM quotes WHERE id = ? LIMIT 1', [quote_id]);

    if (!quoteRows || quoteRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Quote not found' } },
        { status: 404 }
      );
    }

    // Check rfq_reference uniqueness
    const [refRows] = await pool.execute<
      Array<RowDataPacket>
    >('SELECT id FROM rfq_records WHERE rfq_reference = ? LIMIT 1', [rfq_reference]);

    if (refRows && refRows.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_REFERENCE', message: 'RFQ reference already exists' } },
        { status: 409 }
      );
    }

    // Create RFQ record
    const vendorIds = vendors.map((v) => v.vendor_id);
    const [rfqResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO rfq_records (quote_id, rfq_reference, target_country, selected_vendors, status)
       VALUES (?, ?, ?, ?, ?)`,
      [quote_id, rfq_reference, target_country, JSON.stringify(vendorIds), 'open']
    );

    const rfqId = rfqResult.insertId;

    // Create vendor assignments
    for (const vendor of vendors) {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO rfq_vendor_assignments (rfq_id, vendor_id, contact_channel, contact_id, status)
         VALUES (?, ?, ?, ?, ?)`,
        [rfqId, vendor.vendor_id, vendor.contact_channel, vendor.contact_id, 'pending']
      );
    }

    // Link quote to RFQ
    await pool.execute<ResultSetHeader>(
      `UPDATE quotes SET rfq_id = ? WHERE id = ?`,
      [rfqId, quote_id]
    );

    return NextResponse.json({
      success: true,
      data: {
        rfq_id: rfqId,
        rfq_reference,
        quote_id,
        target_country,
        vendor_count: vendors.length,
      },
    });
  } catch (error) {
    console.error('RFQ create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create RFQ' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    if (!idsParam) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing ids parameter' } },
        { status: 400 }
      );
    }
    const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid ids parameter' } },
        { status: 400 }
      );
    }
    const placeholders = ids.map(() => '?').join(',');
    await pool.execute<ResultSetHeader>(`DELETE FROM rfq_records WHERE id IN (${placeholders})`, ids);
    return NextResponse.json({ success: true, data: { deleted: ids.length } });
  } catch (error) {
    console.error('RFQ DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete RFQs' } },
      { status: 500 }
    );
  }
}
