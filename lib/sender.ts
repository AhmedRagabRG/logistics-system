/**
 * Multi-channel message sender
 *
 * Supports:
 * - WhatsApp via Meta Cloud API
 * - Email via Outlook SMTP (or any SMTP)
 * - Telegram via Bot API
 */

// ─── Telegram ──────────────────────────────────────────────────────────────

interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };

    if (!data.ok) {
      return { success: false, error: data.description || 'Telegram API error' };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Telegram send failed' };
  }
}

// ─── WhatsApp (Meta Cloud API) ─────────────────────────────────────────────

interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<WhatsAppSendResult> {
  console.log(`[WHATSAPP-SEND] Attempting free-form text to: ${to}`);
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  console.log(`[WHATSAPP-SEND] Config: phoneNumberId=${phoneNumberId ? 'SET' : 'MISSING'}, accessToken=${accessToken ? 'SET' : 'MISSING'}`);

  if (!phoneNumberId || !accessToken) {
    console.error(`[WHATSAPP-SEND] FAILED: Missing config`);
    return { success: false, error: 'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured' };
  }

  // Normalize phone number: remove non-digits, ensure country code
  let normalizedTo = to.replace(/\D/g, '');
  // Meta API expects numbers without + or whatsapp: prefix
  normalizedTo = normalizedTo.replace(/^\+/, '');

  console.log(`[WHATSAPP-SEND] Normalized number: ${normalizedTo}`);
  console.log(`[WHATSAPP-SEND] Message body: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    console.log(`[WHATSAPP-SEND] POST ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'text',
        text: { body: text },
      }),
    });

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string; code?: number };
    };

    console.log(`[WHATSAPP-SEND] Response status: ${res.status}`);
    console.log(`[WHATSAPP-SEND] Response body:`, JSON.stringify(data, null, 2));

    // If recipient not eligible (no 24h window), suggest using template
    if (!res.ok || data.error) {
      const errMsg = data.error?.message || `WhatsApp API HTTP ${res.status}`;
      console.error(`[WHATSAPP-SEND] FAILED: ${errMsg}`);
      if (data.error?.code === 131030 || errMsg.includes('not eligible')) {
        return {
          success: false,
          error: `${errMsg}. Use sendWhatsAppTemplate() for business-initiated messages.`,
        };
      }
      return { success: false, error: errMsg };
    }

    console.log(`[WHATSAPP-SEND] SUCCESS. Message ID: ${data.messages?.[0]?.id}`);
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'WhatsApp send failed';
    console.error(`[WHATSAPP-SEND] EXCEPTION: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send a WhatsApp message using an approved template.
 * REQUIRED for business-initiated conversations (e.g. vendor RFQs)
 * where the recipient hasn't messaged you in the last 24 hours.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[]
): Promise<WhatsAppSendResult> {
  console.log(`[WHATSAPP-TEMPLATE] Attempting template send to: ${to}, template: ${templateName}`);
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  console.log(`[WHATSAPP-TEMPLATE] Config: phoneNumberId=${phoneNumberId ? 'SET' : 'MISSING'}, accessToken=${accessToken ? 'SET' : 'MISSING'}`);

  if (!phoneNumberId || !accessToken) {
    console.error(`[WHATSAPP-TEMPLATE] FAILED: Missing config`);
    return { success: false, error: 'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured' };
  }

  let normalizedTo = to.replace(/\D/g, '');
  normalizedTo = normalizedTo.replace(/^\+/, '');

  console.log(`[WHATSAPP-TEMPLATE] Normalized number: ${normalizedTo}`);
  console.log(`[WHATSAPP-TEMPLATE] Template: ${templateName}, Lang: ${languageCode}`);
  console.log(`[WHATSAPP-TEMPLATE] Parameters:`, bodyParameters);

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    console.log(`[WHATSAPP-TEMPLATE] POST ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          components: [
            {
              type: 'body',
              parameters: bodyParameters.map((param) => ({
                type: 'text',
                text: param,
              })),
            },
          ],
        },
      }),
    });

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    console.log(`[WHATSAPP-TEMPLATE] Response status: ${res.status}`);
    console.log(`[WHATSAPP-TEMPLATE] Response body:`, JSON.stringify(data, null, 2));

    if (!res.ok || data.error) {
      const errMsg = data.error?.message || `WhatsApp Template API HTTP ${res.status}`;
      console.error(`[WHATSAPP-TEMPLATE] FAILED: ${errMsg}`);
      return { success: false, error: errMsg };
    }

    console.log(`[WHATSAPP-TEMPLATE] SUCCESS. Message ID: ${data.messages?.[0]?.id}`);
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'WhatsApp template send failed';
    console.error(`[WHATSAPP-TEMPLATE] EXCEPTION: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// ─── Email (SMTP / Outlook) ────────────────────────────────────────────────

import nodemailer from 'nodemailer';

interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<EmailSendResult> {
  const smtpHost = process.env.SMTP_HOST || 'smtp.office365.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return { success: false, error: 'SMTP_USER or SMTP_PASS not configured' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: true,
        ciphers: 'SSLv3',
      },
    });

    const info = await transporter.sendMail({
      from: `"Logistics Dashboard" <${smtpUser}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br/>'),
    });

    return { success: true, messageId: info.messageId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Email send failed' };
  }
}

// ─── Unified Sender ────────────────────────────────────────────────────────

import { isWithinMessagingWindow } from './messaging-window';

export interface SendMessageInput {
  channel: 'whatsapp' | 'telegram' | 'email';
  contactId: string;
  message: string;
  subject?: string;
  /**
   * For WhatsApp: REQUIRED when messaging outside the 24h customer-service window.
   * When customer messages us first, we track it and free-form text works for 24h.
   * After 24h, only approved templates can be sent.
   */
  whatsappTemplate?: {
    name: string;
    languageCode: string;
    bodyParameters: string[];
  };
}

export interface SendMessageResult {
  success: boolean;
  channel: string;
  messageId?: string | number;
  error?: string;
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  console.log(`[SEND-MESSAGE] Starting send: channel=${input.channel}, contact=${input.contactId.substring(0, 20)}...`);

  switch (input.channel) {
    case 'whatsapp': {
      // Check if customer initiated conversation within last 24 hours
      console.log(`[SEND-MESSAGE] WhatsApp: checking 24h window for ${input.contactId}`);
      const withinWindow = await isWithinMessagingWindow(input.contactId, 'whatsapp');
      console.log(`[SEND-MESSAGE] WhatsApp: withinWindow=${withinWindow}`);

      if (withinWindow) {
        console.log(`[SEND-MESSAGE] WhatsApp: Sending FREE-FORM text (within 24h window)`);
        const result = await sendWhatsAppMessage(input.contactId, input.message);
        console.log(`[SEND-MESSAGE] WhatsApp free-form result: success=${result.success}, error=${result.error || 'none'}`);
        return { success: result.success, channel: 'whatsapp', messageId: result.messageId, error: result.error };
      }

      // Outside 24h window — MUST use an approved template
      console.log(`[SEND-MESSAGE] WhatsApp: OUTSIDE 24h window, need template`);
      if (input.whatsappTemplate) {
        console.log(`[SEND-MESSAGE] WhatsApp: Using template ${input.whatsappTemplate.name}`);
        const templateResult = await sendWhatsAppTemplate(
          input.contactId,
          input.whatsappTemplate.name,
          input.whatsappTemplate.languageCode,
          input.whatsappTemplate.bodyParameters
        );
        console.log(`[SEND-MESSAGE] WhatsApp template result: success=${templateResult.success}, error=${templateResult.error || 'none'}`);
        return {
          success: templateResult.success,
          channel: 'whatsapp',
          messageId: templateResult.messageId,
          error: templateResult.success ? undefined : `Template failed: ${templateResult.error}`,
        };
      }

      console.error(`[SEND-MESSAGE] WhatsApp: FAILED - no template provided and outside 24h window`);
      return {
        success: false,
        channel: 'whatsapp',
        error: 'Outside 24h messaging window. Create template in Meta Business Manager to send business-initiated messages.',
      };
    }
    case 'telegram': {
      const result = await sendTelegramMessage(input.contactId, input.message);
      return { success: result.success, channel: 'telegram', messageId: result.messageId, error: result.error };
    }
    case 'email': {
      const result = await sendEmail(input.contactId, input.subject || 'Logistics Quote', input.message);
      return { success: result.success, channel: 'email', messageId: result.messageId, error: result.error };
    }
    default:
      return { success: false, channel: input.channel, error: `Unsupported channel: ${input.channel}` };
  }
}
