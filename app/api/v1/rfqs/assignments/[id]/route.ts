import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-auth';
import { logPricingEvent } from '@/lib/audit';
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
    const { response_price, response_currency } = body;

    if (response_price === undefined && response_currency === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (response_price !== undefined) {
      fields.push('response_price = ?');
      values.push(typeof response_price === 'string' ? parseFloat(response_price) : response_price);
    }
    if (response_currency !== undefined) {
      fields.push('response_currency = ?');
      values.push(response_currency ? response_currency.toUpperCase() : null);
    }

    values.push(assignmentId);
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_vendor_assignments SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({
      success: true,
      data: { assignment_id: assignmentId, response_price, response_currency },
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update assignment' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Get assignment details and verify RFQ is draft
    const [rows] = await pool.execute<
      Array<RowDataPacket & {
        id: number;
        rfq_id: number;
        vendor_id: number;
        vendor_name: string;
        rfq_status: string;
        quote_id: number;
        target_country: string;
        rfq_reference: string;
      }>
    >(
      `SELECT a.id, a.rfq_id, a.vendor_id, v.name AS vendor_name, r.status AS rfq_status,
              r.quote_id, r.target_country, r.rfq_reference
       FROM rfq_vendor_assignments a
       JOIN rfq_records r ON r.id = a.rfq_id
       JOIN vendors v ON v.id = a.vendor_id
       WHERE a.id = ?`,
      [assignmentId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } },
        { status: 404 }
      );
    }

    const assignment = rows[0];
    if (assignment.rfq_status !== 'draft') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot remove vendor from RFQ with status '${assignment.rfq_status}'. Only draft RFQs allow vendor removal.` } },
        { status: 409 }
      );
    }

    // Delete the assignment
    await pool.execute<ResultSetHeader>(
      `DELETE FROM rfq_vendor_assignments WHERE id = ?`,
      [assignmentId]
    );

    // Update rfq_records.selected_vendors
    const [rfqRows] = await pool.execute<
      Array<RowDataPacket & { selected_vendors: string }>
    >(
      `SELECT selected_vendors FROM rfq_records WHERE id = ?`,
      [assignment.rfq_id]
    );
    const rfq = rfqRows?.[0];
    if (rfq) {
      const selectedVendors: number[] = JSON.parse(rfq.selected_vendors ?? '[]');
      const updatedVendors = selectedVendors.filter((id: number) => id !== assignment.vendor_id);
      await pool.execute<ResultSetHeader>(
        `UPDATE rfq_records SET selected_vendors = ? WHERE id = ?`,
        [JSON.stringify(updatedVendors), assignment.rfq_id]
      );
    }

    await logPricingEvent({
      event_type: 'rfq_vendor_removed',
      quote_id: assignment.quote_id,
      rfq_id: assignment.rfq_id,
      admin_id: auth.admin.id,
      details: {
        vendor_id: assignment.vendor_id,
        vendor_name: assignment.vendor_name,
        target_country: assignment.target_country,
        rfq_reference: assignment.rfq_reference,
        reason: 'Admin removed vendor from draft RFQ',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        assignment_id: assignmentId,
        vendor_id: assignment.vendor_id,
        vendor_name: assignment.vendor_name,
        message: 'Vendor removed from draft RFQ.',
      },
    });
  } catch (error) {
    console.error('Remove RFQ vendor error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove vendor from RFQ' } },
      { status: 500 }
    );
  }
}
