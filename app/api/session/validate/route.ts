import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get('session')?.value;

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NO_SESSION', message: 'No active session' },
      },
      { status: 401 }
    );
  }

  const session = await validateSession(token);

  if (!session.valid) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SESSION_INVALID', message: 'Session is invalid or expired' },
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      admin: session.admin,
      session: {
        expires_at: session.expires_at?.toISOString(),
      },
    },
  });
}
