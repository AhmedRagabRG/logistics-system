import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-auth';
import { logPricingEvent } from '@/lib/audit';
import { selectVendorsForCountry } from '@/lib/vendor-selector';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function PUT(
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
    const targetCountry = body.target_country?.trim().toUpperCase();
    if (!targetCountry) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target country is required' } },
        { status: 400 }
      );
    }

    if (!/^[A-Z]{2}$/.test(targetCountry)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target country must be a valid 2-letter ISO country code' } },
        { status: 400 }
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
      }>
    >(
      `SELECT id, quote_id, rfq_reference, target_country, status
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
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot change country for RFQ with status '${rfq.status}'. Only draft RFQs are eligible.` } },
        { status: 409 }
      );
    }

    const oldCountry = rfq.target_country;
    if (oldCountry === targetCountry) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CHANGE', message: 'New target country is the same as the current target country.' } },
        { status: 400 }
      );
    }

    // Get new vendors for target country
    const newVendors = await selectVendorsForCountry(targetCountry);
    if (newVendors.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_VENDORS', message: `No active vendors found for ${targetCountry}` } },
        { status: 400 }
      );
    }

    // Delete old assignments
    await pool.execute<ResultSetHeader>(
      `DELETE FROM rfq_vendor_assignments WHERE rfq_id = ?`,
      [rfqId]
    );

    // Create new assignments
    const vendorIds = newVendors.map(v => v.id);
    for (const vendor of newVendors) {
      const channels = Array.isArray(vendor.preferred_channels)
        ? vendor.preferred_channels
        : typeof vendor.preferred_channels === 'string'
          ? JSON.parse(vendor.preferred_channels)
          : ['email'];

      const validChannels = channels.filter((ch: string) => {
        if (ch === 'whatsapp') return !!(vendor.contact_phone && vendor.contact_phone.trim().length > 0);
        if (ch === 'telegram') return !!(vendor.telegram_chat_id && vendor.telegram_chat_id.trim().length > 0);
        if (ch === 'email') return !!(vendor.contact_email && vendor.contact_email.includes('@'));
        return false;
      });

      if (validChannels.length === 0) continue;

      for (const contactChannel of validChannels) {
        let contactId: string;
        if (contactChannel === 'whatsapp') {
          contactId = vendor.contact_phone ?? '';
        } else if (contactChannel === 'telegram') {
          contactId = vendor.telegram_chat_id ?? '';
        } else {
          contactId = vendor.contact_email ?? '';
        }

        await pool.execute<ResultSetHeader>(
          `INSERT INTO rfq_vendor_assignments (rfq_id, vendor_id, contact_channel, contact_id, status)
           VALUES (?, ?, ?, ?, ?)`,
          [rfqId, vendor.id, contactChannel, contactId, 'pending']
        );
      }
    }

    // Update RFQ
    await pool.execute<ResultSetHeader>(
      `UPDATE rfq_records SET target_country = ?, selected_vendors = ? WHERE id = ?`,
      [targetCountry, JSON.stringify(vendorIds), rfqId]
    );

    // Update quote review_reason
    await pool.execute<ResultSetHeader>(
      `UPDATE quotes SET review_reason = ? WHERE id = ?`,
      [`RFQ ${rfq.rfq_reference} target country changed from ${oldCountry} to ${targetCountry}. ${newVendors.length} vendors selected.`, rfq.quote_id]
    );

    await logPricingEvent({
      event_type: 'rfq_country_changed',
      quote_id: rfq.quote_id,
      rfq_id: rfqId,
      admin_id: auth.admin.id,
      details: {
        old_country: oldCountry,
        new_country: targetCountry,
        vendor_count: newVendors.length,
        rfq_reference: rfq.rfq_reference,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        rfq_id: rfqId,
        rfq_reference: rfq.rfq_reference,
        old_country: oldCountry,
        new_country: targetCountry,
        vendor_count: newVendors.length,
        status: 'draft',
      },
    });
  } catch (error) {
    console.error('Change RFQ country error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to change RFQ country' } },
      { status: 500 }
    );
  }
}
