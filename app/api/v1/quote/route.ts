import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, extractBearerToken } from '@/lib/auth-token';
import { processIncomingRequest } from '@/lib/automation-engine';
import { shipmentRequestSchema } from '@/lib/validation';
import { getSystemPausedState } from '@/lib/toggle';

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

    // Check if system is paused
    const isPaused = await getSystemPausedState();
    if (isPaused) {
      return NextResponse.json(
        { success: false, error: { code: 'SYSTEM_PAUSED', message: 'The system is currently paused. New quote requests cannot be processed.' } },
        { status: 503 }
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

    // Validate input schema
    const parseResult = shipmentRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parseResult.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
        },
        { status: 400 }
      );
    }

    const validated = parseResult.data;

    // Process via automation engine
    const result = await processIncomingRequest({
      customer_name: validated.customer_name ?? null,
      customer_contact: validated.customer_contact ?? null,
      origin_postal_code: validated.origin_postal_code ?? null,
      destination_postal_code: validated.destination_postal_code ?? null,
      weight_kg: validated.weight_kg ?? null,
      cargo_type: validated.cargo_type ?? null,
      language: validated.language,
      channel: validated.channel,
      raw_message: typeof body.raw_message === 'string' ? body.raw_message : null,
      handling_mode: validated.handling_mode,
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
