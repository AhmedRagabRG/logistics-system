import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-auth';
import { logVendorEvent } from '@/lib/audit';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    const assignmentId = parseInt(id, 10);
    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid assignment ID' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const price = typeof body.price === 'number' ? body.price : null;
    const currency = typeof body.currency === 'string' && body.currency.length === 3
      ? body.currency.toUpperCase()
      : null;

    if (price === null || price <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid price is required' } },
        { status: 400 }
      );
    }

    // Verify assignment exists and fetch related IDs for logging
    const [rows] = await pool.execute<
      Array<RowDataPacket & { id: number; rfq_id: number; vendor_id: number; response_price: number | null; response_currency: string | null }>
    >(
      'SELECT id, rfq_id, vendor_id, response_price, response_currency FROM rfq_vendor_assignments WHERE id = ? LIMIT 1',
      [assignmentId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } },
        { status: 404 }
      );
    }

    const assignment = rows[0];

    // Update assignment
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_vendor_assignments
       SET response_price = ?, response_currency = ?, responded_at = COALESCE(responded_at, NOW()), status = 'responded'
       WHERE id = ?`,
      [price, currency, assignmentId]
    );

    // Log the update
    await logVendorEvent({
      event_type: 'vendor_response_received',
      quote_id: assignment.rfq_id,
      rfq_id: assignment.rfq_id,
      vendor_id: assignment.vendor_id,
      admin_id: auth.admin.id,
      details: {
        price,
        currency,
        previous_price: assignment.response_price,
        previous_currency: assignment.response_currency,
        source: 'admin_edit',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        assignment_id: assignmentId,
        price,
        currency,
      },
    });
  } catch (error) {
    console.error('RFQ assignment update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update assignment' } },
      { status: 500 }
    );
  }
}
