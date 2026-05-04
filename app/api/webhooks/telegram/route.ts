import { NextRequest, NextResponse } from 'next/server';
import { processIncomingRequest } from '@/lib/automation-engine';
import { trackCustomerMessageWindow } from '@/lib/messaging-window';

/**
 * Telegram Bot Webhook
 *
 * Set webhook via:
 * curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *   -H "Content-Type: application/json" \
 *   -d '{"url":"https://yourdomain.com/api/webhooks/telegram"}'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Telegram sends many update types. We only care about text messages.
    const message = body.message || body.edited_message || body.channel_post;

    if (!message) {
      // Not a message update (callback_query, inline_query, etc.) — acknowledge it
      return NextResponse.json({ success: true, data: { ignored: true, reason: 'not_a_message' } });
    }

    if (!message.text) {
      // Message without text (photo, sticker, voice, etc.) — acknowledge it
      return NextResponse.json({ success: true, data: { ignored: true, reason: 'no_text' } });
    }

    const fromUser = message.from || {};
    const customerName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || null;
    const messageText = message.text;
    const chatId = message.chat?.id ? String(message.chat.id) : null;

    // NOTE: Telegram has no 24h messaging window restriction.
    // WhatsApp-only tracking is used for compliance with Meta's free-form policy.
    // Telegram bots can always send messages freely.

    const result = await processIncomingRequest({
      raw_message: String(messageText),
      customer_name: customerName,
      customer_contact: chatId,
      channel: 'telegram',
      handling_mode: 'auto',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    // Always return 200 to Telegram so it doesn't retry
    // Log the error internally but acknowledge receipt
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 200 }
    );
  }
}
