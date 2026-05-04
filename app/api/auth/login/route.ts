import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { logAuthEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/ip';
import type { AuthResult } from '@/types/auth';

const loginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' },
      },
      { status: 400 }
    );
  }

  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: parseResult.error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  const { username, password } = parseResult.data;

  try {
    const [rows] = await pool.execute<
      Array<
        RowDataPacket & {
          id: number;
          username: string;
          display_name: string | null;
          password_hash: string;
          is_active: boolean;
        }
      >
    >(
      'SELECT id, username, display_name, password_hash, is_active FROM admin_accounts WHERE username = ? LIMIT 1',
      [username]
    );

    const admin = rows && rows.length > 0 ? rows[0] : null;

    // Constant-time password check to prevent timing attacks
    const dummyHash =
      '$2a$10$abcdefghijklmnopqrstuvwxycdefghijklmnopqrstu';
    const hashToCheck = admin?.password_hash ?? dummyHash;
    const passwordValid = await verifyPassword(password, hashToCheck);

    if (!admin || !passwordValid) {
      await logAuthEvent({
        event_type: 'login_failure',
        ip_address: getClientIp(request),
        user_agent: request.headers.get('user-agent') ?? null,
        details: { reason: 'invalid_credentials', username },
      });

      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
        },
        { status: 401 }
      );
    }

    if (!admin.is_active) {
      await logAuthEvent({
        event_type: 'login_failure',
        admin_id: admin.id,
        ip_address: getClientIp(request),
        user_agent: request.headers.get('user-agent') ?? null,
        details: { reason: 'account_inactive', username },
      });

      return NextResponse.json(
        {
          success: false,
          error: { code: 'ACCOUNT_INACTIVE', message: 'Account is deactivated' },
        },
        { status: 403 }
      );
    }

    // Create session in database
    const sessionId = crypto.randomUUID();
    const token = await createSessionToken(sessionId);

    await pool.execute(
      `INSERT INTO sessions (session_token, admin_id, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [
        sessionId,
        admin.id,
        getClientIp(request),
        request.headers.get('user-agent') ?? null,
      ]
    );

    await setSessionCookie(token);

    await logAuthEvent({
      event_type: 'login_success',
      admin_id: admin.id,
      session_token: sessionId,
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent') ?? null,
    });

    const result: AuthResult = {
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name,
      },
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
