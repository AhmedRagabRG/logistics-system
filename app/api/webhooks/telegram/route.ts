import { NextRequest, NextResponse } from 'next/server';
import { processIncomingRequest, processVendorReply } from '@/lib/automation-engine';
import { getSystemPausedState } from '@/lib/toggle';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Telegram Bot Webhook
 *
 * Set webhook via:
 * curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *   -H "Content-Type: application/json" \
 *   -d '{"url":"https://9949-88-214-57-76.ngrok-free.app/api/webhooks/telegram"}'
 *
 * IMPORTANT: This webhook receives messages from BOTH customers AND vendors.
 * We MUST distinguish them:
 * - Customers → processIncomingRequest (creates quotes)
 * - Vendors → processVendorReply (updates RFQ assignments)
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
    const senderName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || null;
    const messageText = message.text;
    const chatId = message.chat?.id ? String(message.chat.id) : null;

    if (!chatId) {
      return NextResponse.json({ success: true, data: { ignored: true, reason: 'no_chat_id' } });
    }

    // Check if sender is a known vendor by telegram_chat_id
    const [vendorRows] = await pool.execute<
      Array<RowDataPacket & { id: number }>
    >(
      'SELECT id FROM vendors WHERE telegram_chat_id = ? AND is_active = 1 LIMIT 1',
      [chatId]
    );
    const isVendor = vendorRows && vendorRows.length > 0;

    if (isVendor) {
      // Vendor reply via Telegram
      console.log(`[TELEGRAM-WEBHOOK] Vendor reply detected from chat: ${chatId}`);
      const result = await processVendorReply(chatId, String(messageText), 'telegram');
      return NextResponse.json({ success: result.success, data: result });
    }

    // Customer quote request via Telegram (blocked if system is paused)
    const isPaused = await getSystemPausedState();
    if (isPaused) {
      console.log(`[TELEGRAM-WEBHOOK] System is paused — rejecting customer quote request`);
      return NextResponse.json(
        { success: false, error: { code: 'SYSTEM_PAUSED', message: 'The system is currently paused. New quote requests cannot be processed.' } },
        { status: 503 }
      );
    }

    const result = await processIncomingRequest({
      raw_message: String(messageText),
      customer_name: senderName,
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
