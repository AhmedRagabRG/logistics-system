import { NextRequest, NextResponse } from 'next/server';
import { processIncomingRequest, processVendorReply } from '@/lib/automation-engine';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Email Webhook
 *
 * Receives emails forwarded by n8n (or any HTTP client).
 * n8n connects to Outlook via IMAP/Microsoft Graph, reads new emails,
 * then POSTs the parsed data here.
 *
 * Expected body from n8n (HTTP Request node):
 * {
 *   from: "sender@example.com",
 *   subject: "Quote request",
 *   text: "I need a quote from Turkey to Germany...",
 *   body: "same as text"  // fallback
 * }
 *
 * The endpoint auto-detects if the sender is a known vendor
 * (by matching `from` against `vendors.contact_email`) and routes
 * the message accordingly:
 *   - Vendor → processVendorReply()  (records RFQ bid)
 *   - Customer → processIncomingRequest()  (creates quote/RFQ)
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: verify shared secret from n8n
    const secret = request.headers.get('x-webhook-secret');
    const expected = process.env.AUTH_TOKEN;
    if (expected && secret !== expected) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid webhook secret' } },
        { status: 401 }
      );
    }

    const body = await request.json();

    const fromEmail = body.from || body.sender || body.envelope?.from || '';
    const subject = body.subject || '';
    const messageText = body.text || body.plain || body.body || '';

    if (!messageText) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Empty message' } },
        { status: 400 }
      );
    }

    // Check if sender is a known vendor
    const [vendorRows] = await pool.execute<
      Array<RowDataPacket & { id: number }>
    >(
      'SELECT id FROM vendors WHERE contact_email = ? AND is_active = 1 LIMIT 1',
      [fromEmail.toLowerCase()]
    );
    const isVendor = vendorRows && vendorRows.length > 0;

    if (isVendor) {
      // Vendor reply via email
      console.log(`[EMAIL-WEBHOOK] Vendor reply detected from: ${fromEmail}`);
      const replyText = subject ? `${subject}\n\n${messageText}` : messageText;
      const result = await processVendorReply(fromEmail, replyText);
      return NextResponse.json({ success: result.success, data: result });
    }

    // Customer quote request via email
    const fullMessage = subject ? `Subject: ${subject}\n\n${messageText}` : messageText;

    const result = await processIncomingRequest({
      raw_message: fullMessage,
      customer_name: fromEmail,
      customer_contact: fromEmail || null,
      channel: 'email',
      handling_mode: 'auto',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Email webhook error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process email' } },
      { status: 500 }
    );
  }
}
