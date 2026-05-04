import { NextRequest, NextResponse } from 'next/server';
import { processVendorReply } from '@/lib/automation-engine';

/**
 * Vendor Reply Webhook
 * 
 * This endpoint receives vendor replies from any channel (WhatsApp, Email, Telegram).
 * Configure your messaging provider to forward vendor replies here.
 * 
 * Body format:
 * {
 *   contact_id: "whatsapp:+201234567890" or "vendor@email.com",
 *   reply_text: "Price is 1500 EUR ref RFQ-20260102-001",
 *   channel: "whatsapp" | "email" | "telegram"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const contactId = body.contact_id || body.From || body.from || body.sender || '';
    const replyText = body.reply_text || body.Body || body.text || body.message || '';

    if (!contactId || !replyText) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing contact_id or reply_text' } },
        { status: 400 }
      );
    }

    const result = await processVendorReply(String(contactId), String(replyText));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Vendor reply webhook error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process vendor reply' } },
      { status: 500 }
    );
  }
}
