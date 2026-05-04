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
 * WhatsApp Webhook — Meta Cloud API format
 *
 * IMPORTANT: This webhook receives messages from BOTH customers AND vendors.
 * We MUST distinguish them:
 * - Customers → processIncomingRequest (creates quotes)
 * - Vendors → processVendorReply (updates RFQ assignments)
 *
 * Meta sends webhook events in this nested structure:
 * {
 *   object: "whatsapp_business_account",
 *   entry: [{
 *     changes: [{
 *       value: {
 *         messaging_product: "whatsapp",
 *         metadata: { display_phone_number, phone_number_id },
 *         contacts: [{ profile: { name }, wa_id }],
 *         messages: [{
 *           from: "PHONE_NUMBER",
 *           id: "wamid.ID",
 *           timestamp: "1234567890",
 *           text: { body: "MESSAGE_BODY" },
 *           type: "text"
 *         }]
 *       }
 *     }]
 *   }]
 * }
 *
 * We MUST respond with HTTP 200 within ~20 seconds.
 * Meta retries webhooks that return non-2xx.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log(`[WHATSAPP-WEBHOOK] Received POST. Body keys:`, Object.keys(body));

    // Try Meta Cloud API nested format first
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    console.log(`[WHATSAPP-WEBHOOK] Entry: ${body.entry ? 'YES' : 'NO'}, Changes: ${entry?.changes ? 'YES' : 'NO'}, Messages: ${value?.messages ? 'YES' : 'NO'}`);

    // Meta sends many event types. Only process actual messages.
    // Status updates (delivered, read, failed) have 'statuses' not 'messages'.
    if (!value?.messages || !Array.isArray(value.messages)) {
      console.log(`[WHATSAPP-WEBHOOK] No messages in payload. Event type: ${Object.keys(value || {}).join(', ') || 'unknown'}. Returning 200.`);
      return NextResponse.json({ success: true, ignored: true });
    }

    console.log(`[WHATSAPP-WEBHOOK] Processing ${value.messages.length} message(s) in Meta format`);

    // Meta format — process each message
    const contacts = value.contacts || [];
    const contactMap = new Map<string, string>();
    for (const c of contacts) {
      const phone = c.wa_id || c.profile?.wa_id;
      const name = c.profile?.name;
      if (phone && name) contactMap.set(phone, name);
    }

    for (const msg of value.messages) {
      const fromNumber = msg.from;
      const msgType = msg.type;
      let messageText = '';

      if (msgType === 'text' && msg.text?.body) {
        messageText = msg.text.body;
      } else if (msgType === 'image' && msg.image?.caption) {
        messageText = msg.image.caption;
      }
      // Ignore other types (audio, video, document, etc.)

      console.log(`[WHATSAPP-WEBHOOK] Message from=${fromNumber}, type=${msgType}, text="${messageText.substring(0, 50)}..."`);

      if (!messageText || !fromNumber) {
        console.log(`[WHATSAPP-WEBHOOK] Skipping message: missing text or from number`);
        continue;
      }

      const profileName = contactMap.get(fromNumber) || null;
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

        // Fire-and-forget: don't await, just return 200 to Meta
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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Still return 200 so Meta doesn't retry endlessly
    return NextResponse.json({ success: true });
  }
}

/**
 * WhatsApp webhook verification (Meta Cloud API)
 * GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const verifyToken = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe') {
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'default-verify-token';
    if (verifyToken === expectedToken) {
      return new NextResponse(challenge, { status: 200 });
    }
  }

  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Verification failed' } },
    { status: 403 }
  );
}
