import { NextRequest, NextResponse } from 'next/server';
import { processIncomingRequest, processVendorReply } from '@/lib/automation-engine';
import { trackCustomerMessageWindow, normalizeContactId } from '@/lib/messaging-window';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Check if a phone number belongs to a vendor in our database.
 */
async function isVendorPhone(phoneNumber: string): Promise<boolean> {
  // Normalize to digits only for comparison
  const digits = phoneNumber.replace(/\D/g, '');
  const [rows] = await pool.execute<
    Array<RowDataPacket & { id: number }>
  >(
    `SELECT id FROM vendors
     WHERE is_active = TRUE
       AND contact_phone IS NOT NULL
       AND (
         contact_phone LIKE ?
         OR contact_phone LIKE ?
         OR REPLACE(REPLACE(REPLACE(contact_phone, ' ', ''), '-', ''), '+', '') = ?
       )
     LIMIT 1`,
    [`%${digits}`, `%${phoneNumber}`, digits]
  );
  return rows && rows.length > 0;
}

/**
 * WhatsApp Webhook — receives messages forwarded by n8n
 *
 * n8n connects to WhatsApp (via Meta API, WhatsApp Business API, or third-party),
 * receives incoming messages, then POSTs a simplified payload here.
 *
 * Expected body from n8n:
 * {
 *   from: "PHONE_NUMBER",           // required: sender phone number
 *   text: "MESSAGE_BODY",           // required: message text
 *   profile_name: "Sender Name"     // optional: contact name from WhatsApp
 * }
 *
 * We MUST respond with HTTP 200.
 * n8n retries based on its own workflow configuration.
 *
 * IMPORTANT: This webhook receives messages from BOTH customers AND vendors.
 * We MUST distinguish them:
 * - Customers → processIncomingRequest (creates quotes)
 * - Vendors → processVendorReply (updates RFQ assignments)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log(`[WHATSAPP-WEBHOOK] Received POST from n8n. Body keys:`, Object.keys(body));

    // Support flexible field names from n8n
    const fromNumber = body.from || body.sender || body.wa_id || body.phone || '';
    const messageText = body.text || body.message || body.body || '';
    const profileName = body.profile_name || body.name || body.profile?.name || null;

    if (!fromNumber || !messageText) {
      console.log(`[WHATSAPP-WEBHOOK] Missing from or text. from=${fromNumber}, text=${messageText}`);
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing from or text' } },
        { status: 400 }
      );
    }

    console.log(`[WHATSAPP-WEBHOOK] Message from=${fromNumber}, text="${String(messageText).substring(0, 50)}..."`);

    const normalizedContact = normalizeContactId(`whatsapp:+${fromNumber}`, 'whatsapp');
    console.log(`[WHATSAPP-WEBHOOK] Normalized contact: ${normalizedContact}, Name: ${profileName || 'unknown'}`);

    // CRITICAL: Check if sender is a VENDOR or a CUSTOMER
    console.log(`[WHATSAPP-WEBHOOK] Checking if sender is a vendor...`);
    const senderIsVendor = await isVendorPhone(fromNumber);
    console.log(`[WHATSAPP-WEBHOOK] Sender is vendor: ${senderIsVendor}`);

    if (senderIsVendor) {
      // VENDOR REPLY: update RFQ, don't create a new quote!
      console.log(`[WHATSAPP-WEBHOOK] Processing as VENDOR REPLY`);
      processVendorReply(normalizedContact, String(messageText)).then((result) => {
        console.log(`[WHATSAPP-WEBHOOK] Vendor reply processed: matched=${result.matched}, message=${result.message}`);
      }).catch((err) => {
        console.error(`[WHATSAPP-WEBHOOK] processVendorReply error:`, err);
      });
    } else {
      // CUSTOMER MESSAGE: create quote
      console.log(`[WHATSAPP-WEBHOOK] Processing as CUSTOMER MESSAGE`);

      // Track that customer messaged us — opens 24h free-form reply window
      console.log(`[WHATSAPP-WEBHOOK] Tracking 24h window for ${normalizedContact}`);
      trackCustomerMessageWindow(normalizedContact, 'whatsapp').then(() => {
        console.log(`[WHATSAPP-WEBHOOK] Window tracked successfully for ${normalizedContact}`);
      }).catch((err) => {
        console.error(`[WHATSAPP-WEBHOOK] Window tracking error:`, err);
      });

      // Fire-and-forget: don't await, just return 200 to n8n quickly
      console.log(`[WHATSAPP-WEBHOOK] Calling processIncomingRequest...`);
      processIncomingRequest({
        raw_message: String(messageText),
        customer_name: profileName,
        customer_contact: normalizedContact,
        channel: 'whatsapp',
        handling_mode: 'auto',
      }).then((results) => {
        const resultList = Array.isArray(results) ? results : [results];
        for (const r of resultList) {
          console.log(`[WHATSAPP-WEBHOOK] Quote created: quote_id=${r.quote_id}, status=${r.status}`);
        }
      }).catch((err) => {
        console.error(`[WHATSAPP-WEBHOOK] processIncomingRequest error:`, err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Still return 200 so n8n doesn't retry endlessly (unless configured to)
    return NextResponse.json({ success: true });
  }
}
