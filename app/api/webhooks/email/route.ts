import { NextRequest, NextResponse } from 'next/server';
import { processIncomingRequest, processVendorReply } from '@/lib/automation-engine';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Email Webhook
 *
 * Handles both customer quote requests and vendor replies via email.
 * Configure your email service (e.g. SendGrid Inbound Parse, AWS SES, Postmark)
 * to POST parsed emails to this endpoint.
 *
 * Expected body format:
 * {
 *   from: "customer@example.com",
 *   subject: "Quote request",
 *   text: "message text here",
 *   html: "<p>message html</p>"
 * }
 */
export async function POST(request: NextRequest) {
  try {
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
