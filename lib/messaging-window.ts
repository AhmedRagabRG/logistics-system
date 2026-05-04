import pool from './db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const MESSAGING_WINDOW_HOURS = 24;

/**
 * Track that a customer sent us a message.
 * This opens a 24-hour window for free-form replies (WHATSAPP ONLY).
 * Telegram has no messaging window restriction.
 */
export async function trackCustomerMessageWindow(
  contactId: string,
  channel: string
): Promise<void> {
  if (channel !== 'whatsapp') {
    // Only WhatsApp has a 24h messaging window. Telegram bots can always send.
    return;
  }
  console.log(`[MSG-WINDOW] Tracking window for ${channel}:${contactId}`);
  await pool.execute<ResultSetHeader>(
    `INSERT INTO customer_messaging_windows (contact_id, channel, last_message_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE last_message_at = NOW()`,
    [contactId, channel]
  );
  console.log(`[MSG-WINDOW] Window tracked/updated for ${channel}:${contactId}`);
}

/**
 * Check if we're still within the 24h free-form messaging window (WHATSAPP ONLY).
 * Telegram has no such restriction — bots can always send messages.
 */
export async function isWithinMessagingWindow(
  contactId: string,
  channel: string
): Promise<boolean> {
  if (channel !== 'whatsapp') {
    // Telegram bots can always send messages; no 24h window restriction.
    return true;
  }
  console.log(`[MSG-WINDOW] Checking window for ${channel}:${contactId}`);
  const [rows] = await pool.execute<
    Array<RowDataPacket & { last_message_at: Date }>
  >(
    `SELECT last_message_at FROM customer_messaging_windows
     WHERE contact_id = ? AND channel = ?
     AND last_message_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     LIMIT 1`,
    [contactId, channel, MESSAGING_WINDOW_HOURS]
  );

  const withinWindow = rows && rows.length > 0;
  if (withinWindow) {
    const lastMsg = (rows as Array<RowDataPacket & { last_message_at: Date }>)[0].last_message_at;
    console.log(`[MSG-WINDOW] WITHIN 24h window for ${channel}:${contactId}. Last message: ${lastMsg}`);
  } else {
    console.log(`[MSG-WINDOW] OUTSIDE 24h window for ${channel}:${contactId}. No recent message found.`);
  }
  return withinWindow;
}

/**
 * Format a contact ID for storage (normalize whatsapp: prefix, etc.)
 */
export function normalizeContactId(contactId: string, channel: string): string {
  if (channel === 'whatsapp') {
    // Keep the whatsapp:+ prefix for tracking, but ensure consistent format
    const digits = contactId.replace(/\D/g, '');
    return `whatsapp:+${digits}`;
  }
  return contactId;
}
