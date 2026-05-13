/**
 * Multi-channel message sender
 *
 * Supports:
 * - WhatsApp via n8n webhook (n8n connects to WhatsApp)
 * - Email via n8n webhook (preferred) or SMTP fallback
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

// ─── WhatsApp via n8n Webhook ──────────────────────────────────────────────

interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<WhatsAppSendResult> {
  const webhookUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;

  if (!webhookUrl) {
    return { success: false, error: 'N8N_WHATSAPP_WEBHOOK_URL not configured' };
  }

  // Normalize phone number: remove non-digits
  const normalizedTo = to.replace(/\D/g, '');

  console.log(`[WHATSAPP-N8N] Sending to n8n webhook: ${webhookUrl}, to=${normalizedTo}`);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: normalizedTo,
        message: text,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      error?: string;
    };

    if (!res.ok) {
      const errText = await res.text().catch(() => 'n8n webhook error');
      console.error(`[WHATSAPP-N8N] Webhook error: ${res.status} ${errText}`);
      return { success: false, error: `n8n: ${errText}` };
    }

    console.log(`[WHATSAPP-N8N] Success`);
    return { success: true, messageId: data.messageId || `n8n-${Date.now()}` };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'WhatsApp n8n send failed';
    console.error(`[WHATSAPP-N8N] Exception: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send a WhatsApp message using an approved template via n8n.
 * n8n handles the actual template selection and Meta API call.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[]
): Promise<WhatsAppSendResult> {
  const webhookUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;

  if (!webhookUrl) {
    return { success: false, error: 'N8N_WHATSAPP_WEBHOOK_URL not configured' };
  }

  const normalizedTo = to.replace(/\D/g, '');

  console.log(`[WHATSAPP-N8N-TEMPLATE] Sending template via n8n: template=${templateName}, to=${normalizedTo}`);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: normalizedTo,
        message: bodyParameters.join(' | '),
        template: {
          name: templateName,
          languageCode,
          bodyParameters,
        },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      error?: string;
    };

    if (!res.ok) {
      const errText = await res.text().catch(() => 'n8n webhook error');
      console.error(`[WHATSAPP-N8N-TEMPLATE] Webhook error: ${res.status} ${errText}`);
      return { success: false, error: `n8n: ${errText}` };
    }

    console.log(`[WHATSAPP-N8N-TEMPLATE] Success`);
    return { success: true, messageId: data.messageId || `n8n-${Date.now()}` };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'WhatsApp n8n template send failed';
    console.error(`[WHATSAPP-N8N-TEMPLATE] Exception: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// ─── Email (n8n Webhook / SMTP fallback) ───────────────────────────────────

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
  // Prefer n8n webhook if configured (n8n handles Outlook via its own connection)
  const n8nWebhook = process.env.N8N_EMAIL_WEBHOOK_URL;
  if (n8nWebhook) {
    try {
      const res = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, html }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => 'n8n webhook error');
        return { success: false, error: `n8n: ${err}` };
      }
      return { success: true, messageId: `n8n-${Date.now()}` };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'n8n webhook failed' };
    }
  }

  // Fallback to SMTP
  const smtpHost = process.env.SMTP_HOST || 'smtp.office365.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return { success: false, error: 'SMTP not configured and N8N_EMAIL_WEBHOOK_URL not set' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const info = await transporter.sendMail({
      from: `"Logistics Dashboard" <${smtpUser}>`,
      to, subject, text,
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
   * For WhatsApp via n8n: n8n handles the 24h window and template logic,
   * but we pass template info so n8n can use it if needed.
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
        console.log(`[SEND-MESSAGE] WhatsApp: Sending free-form text (within 24h window)`);
        const result = await sendWhatsAppMessage(input.contactId, input.message);
        console.log(`[SEND-MESSAGE] WhatsApp free-form result: success=${result.success}, error=${result.error || 'none'}`);
        return { success: result.success, channel: 'whatsapp', messageId: result.messageId, error: result.error };
      }

      // Outside 24h window — pass template info to n8n
      console.log(`[SEND-MESSAGE] WhatsApp: OUTSIDE 24h window, passing template to n8n`);
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

      // No template provided — try sending anyway and let n8n handle it
      console.log(`[SEND-MESSAGE] WhatsApp: No template provided, letting n8n handle`);
      const result = await sendWhatsAppMessage(input.contactId, input.message);
      return { success: result.success, channel: 'whatsapp', messageId: result.messageId, error: result.error };
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
