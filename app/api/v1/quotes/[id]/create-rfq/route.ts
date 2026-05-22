import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-auth';
import { logPricingEvent, logVendorEvent } from '@/lib/audit';
import { selectVendorsForCountry } from '@/lib/vendor-selector';
import { generateVendorMessage } from '@/lib/openai';
import { sendMessage, sendWhatsAppTemplate } from '@/lib/sender';
import { normalizeContactId } from '@/lib/messaging-window';
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
    const targetCountry = body.target_country?.trim().toUpperCase();
    if (!targetCountry) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target country is required' } },
        { status: 400 }
      );
    }

    // VALIDATION: Target country must be a valid 2-letter ISO code
    if (!/^[A-Z]{2}$/.test(targetCountry)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target country must be a valid 2-letter ISO country code (e.g., DE, TR)' } },
        { status: 400 }
      );
    }

    // Verify quote exists and does not already have an RFQ
    const [quoteRows] = await pool.execute<
      Array<RowDataPacket & {
        id: number;
        rfq_id: number | null;
        status: string;
        origin_region: string;
        destination_region: string;
        origin_postal_code: string | null;
        destination_postal_code: string | null;
        weight_kg: number | null;
        cargo_type: string | null;
      }>
    >(
      `SELECT q.id, q.rfq_id, q.status, q.origin_region, q.destination_region,
              q.origin_postal_code, q.destination_postal_code, q.weight_kg, q.cargo_type
       FROM quotes q
       WHERE q.id = ? LIMIT 1`,
      [quoteId]
    );

    if (!quoteRows || quoteRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Quote not found' } },
        { status: 404 }
      );
    }

    const quote = quoteRows[0];

    // VALIDATION: Only pending quotes can have RFQs created
    if (quote.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot create RFQ for quote with status '${quote.status}'. Only pending quotes are eligible.` } },
        { status: 409 }
      );
    }

    if (quote.rfq_id) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_HAS_RFQ', message: 'Quote already has an RFQ' } },
        { status: 409 }
      );
    }

    // Select ALL active vendors for target country
    const activeVendors = await selectVendorsForCountry(targetCountry);

    if (activeVendors.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_VENDORS', message: `No active vendors found for ${targetCountry}` } },
        { status: 400 }
      );
    }

    // Generate RFQ reference
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const rfqReference = `RFQ-${timestamp}-${random}`;

    const vendorIds = activeVendors.map((v) => v.id);

    // Create RFQ record
    const [rfqResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO rfq_records (quote_id, rfq_reference, target_country, selected_vendors, status)
       VALUES (?, ?, ?, ?, ?)`,
      [quoteId, rfqReference, targetCountry, JSON.stringify(vendorIds), 'open']
    );

    const rfqId = rfqResult.insertId;

    // Link quote to RFQ and set to pending
    await pool.execute<ResultSetHeader>(
      `UPDATE quotes SET rfq_id = ?, status = 'pending', review_reason = ? WHERE id = ?`,
      [rfqId, `RFQ created manually by admin for ${targetCountry}. Waiting for vendor responses.`, quoteId]
    );

    // Get shipment request details for vendor messages
    const [shipmentRows] = await pool.execute<
      Array<RowDataPacket & { language: string; customer_name: string | null }>
    >(
      `SELECT s.language, s.customer_name
       FROM quotes q
       JOIN shipment_requests s ON s.id = q.shipment_request_id
       WHERE q.id = ?`,
      [quoteId]
    );
    const shipment = shipmentRows?.[0];
    const language = (shipment?.language as 'ar' | 'tr' | 'en') ?? 'en';

    // Create vendor assignments and send messages via valid preferred channels only
    const skippedVendors: Array<{ vendor_id: number; name: string; reason: string }> = [];

    for (const vendor of activeVendors) {
      const channels = Array.isArray(vendor.preferred_channels)
        ? vendor.preferred_channels
        : typeof vendor.preferred_channels === 'string'
          ? JSON.parse(vendor.preferred_channels)
          : ['email'];

      // VALIDATION: Only use channels where vendor has valid contact info
      const validChannels = channels.filter((ch: string) => {
        if (ch === 'whatsapp') return !!(vendor.contact_phone && vendor.contact_phone.trim().length > 0);
        if (ch === 'telegram') return !!(vendor.telegram_chat_id && vendor.telegram_chat_id.trim().length > 0);
        if (ch === 'email') return !!(vendor.contact_email && vendor.contact_email.includes('@'));
        return false;
      });

      if (validChannels.length === 0) {
        skippedVendors.push({ vendor_id: vendor.id, name: vendor.name, reason: 'No valid contact info for preferred channels' });
        continue;
      }

      for (const contactChannel of validChannels) {
        let contactId: string;
        if (contactChannel === 'whatsapp') {
          contactId = vendor.contact_phone ?? '';
        } else if (contactChannel === 'telegram') {
          contactId = vendor.telegram_chat_id ?? '';
        } else {
          contactId = vendor.contact_email ?? '';
        }

        if (contactChannel === 'whatsapp') {
          contactId = normalizeContactId(contactId, 'whatsapp');
        }

        await pool.execute<ResultSetHeader>(
          `INSERT INTO rfq_vendor_assignments (rfq_id, vendor_id, contact_channel, contact_id, status)
           VALUES (?, ?, ?, ?, ?)`,
          [rfqId, vendor.id, contactChannel, contactId, 'pending']
        );

        let sendResult: { success: boolean; messageId?: string | number; error?: string };
        let sentMessage: string;

        if (contactChannel === 'whatsapp') {
          const templateParams = [
            vendor.name,
            String(quote.origin_region),
            String(quote.destination_region),
            `${(quote.weight_kg ?? 0).toLocaleString()} kg`,
            quote.cargo_type ?? 'General Cargo',
            rfqReference,
          ];

          sendResult = await sendWhatsAppTemplate(
            contactId,
            'logistics_rfq_request',
            'en',
            templateParams
          );
          sentMessage = `[Template: logistics_rfq_request] ${templateParams.join(' | ')}`;
        } else {
          const msg = await generateVendorMessage({
            rfq_reference: rfqReference,
            target_country: targetCountry,
            origin_region: String(quote.origin_region),
            destination_region: String(quote.destination_region),
            weight_kg: quote.weight_kg ?? 0,
            cargo_type: quote.cargo_type,
            vendor_name: vendor.name,
            language,
            channel: contactChannel as 'email' | 'whatsapp' | 'telegram',
          });
          sentMessage = msg.message;

          sendResult = await sendMessage({
            channel: contactChannel as 'whatsapp' | 'telegram' | 'email',
            contactId,
            message: msg.message,
            subject: msg.subject,
          });
        }

        await logVendorEvent({
          event_type: sendResult.success ? 'vendor_rfq_sent' : 'vendor_rfq_send_failed',
          quote_id: quoteId,
          rfq_id: rfqId,
          vendor_id: vendor.id,
          details: {
            rfq_reference: rfqReference,
            channel: contactChannel,
            contact_id: contactId,
            message: sentMessage,
            sent: sendResult.success,
            error: sendResult.error ?? null,
          },
        });
      }
    }

    if (skippedVendors.length > 0) {
      console.log(`[RFQ-MANUAL] Skipped ${skippedVendors.length} vendors due to missing contact info:`, skippedVendors);
      await logPricingEvent({
        event_type: 'rfq_vendors_skipped',
        quote_id: quoteId,
        rfq_id: rfqId,
        admin_id: auth.admin.id,
        details: { skipped_vendors: skippedVendors },
      });
    }

    await logPricingEvent({
      event_type: 'rfq_initiated',
      quote_id: quoteId,
      rfq_id: rfqId,
      admin_id: auth.admin.id,
      details: { target_country: targetCountry, vendor_count: activeVendors.length, rfq_reference: rfqReference, source: 'manual_from_quote' },
    });

    return NextResponse.json({
      success: true,
      data: {
        rfq_id: rfqId,
        rfq_reference: rfqReference,
        quote_id: quoteId,
        target_country: targetCountry,
        vendor_count: activeVendors.length,
        status: 'open',
      },
    });
  } catch (error) {
    console.error('Create RFQ from quote error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create RFQ' } },
      { status: 500 }
    );
  }
}
