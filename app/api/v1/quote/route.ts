import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, extractBearerToken } from '@/lib/auth-token';
import { processIncomingRequest } from '@/lib/automation-engine';

export async function POST(request: NextRequest) {
  try {
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing auth token' } },
        { status: 401 }
      );
    }

    const authResult = await verifyAuthToken(token);
    if (!authResult.valid) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid auth token' } },
        { status: 401 }
      );
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // Process via automation engine
    const result = await processIncomingRequest({
      customer_name: typeof body.customer_name === 'string' ? body.customer_name : null,
      customer_contact: typeof body.customer_contact === 'string' ? body.customer_contact : null,
      origin_postal_code: typeof body.origin_postal_code === 'string' ? body.origin_postal_code : null,
      destination_postal_code: typeof body.destination_postal_code === 'string' ? body.destination_postal_code : null,
      weight_kg: typeof body.weight_kg === 'number' ? body.weight_kg : null,
      cargo_type: typeof body.cargo_type === 'string' ? body.cargo_type : null,
      language: body.language as 'ar' | 'tr' | 'en' | undefined,
      channel: body.channel as 'whatsapp' | 'telegram' | 'email' | undefined,
      raw_message: typeof body.raw_message === 'string' ? body.raw_message : null,
      handling_mode: body.handling_mode as 'auto' | 'manual' | 'external' | undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Quote ingress error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
