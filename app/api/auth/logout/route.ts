import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { clearSessionCookie, verifySessionToken } from '@/lib/session';
import { logAuthEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/ip';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'NO_SESSION', message: 'No active session' },
      },
      { status: 401 }
    );
  }

  try {
    const payload = await verifySessionToken(sessionCookie);

    if (payload) {
      // Delete session from database
      await pool.execute('DELETE FROM sessions WHERE session_token = ?', [
        payload.sessionId,
      ]);

      await logAuthEvent({
        event_type: 'logout',
        session_token: payload.sessionId,
        ip_address: getClientIp(request),
        user_agent: request.headers.get('user-agent') ?? null,
      });
    }

    await clearSessionCookie();

    return NextResponse.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
