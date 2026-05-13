import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage, sendWhatsAppMessage, sendEmail } from '@/lib/sender';

// Note: sendWhatsAppMessage now calls n8n webhook instead of Meta API directly

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channel, recipient, message } = body;

    if (!channel || !recipient || !message) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing channel, recipient, or message' } },
        { status: 400 }
      );
    }

    let result;
    switch (channel) {
      case 'telegram':
        result = await sendTelegramMessage(recipient, message);
        break;
      case 'whatsapp':
        result = await sendWhatsAppMessage(recipient, message);
        break;
      case 'email':
        result = await sendEmail(recipient, 'Test Message', message);
        break;
      default:
        return NextResponse.json(
          { success: false, error: { message: 'Invalid channel. Use telegram, whatsapp, or email' } },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error || 'Send failed' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { messageId: result.messageId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
