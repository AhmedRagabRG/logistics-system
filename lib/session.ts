import { cookies } from 'next/headers';
import type { RowDataPacket } from 'mysql2/promise';
import pool from './db';
import { createSessionToken as edgeCreateSessionToken, verifySessionToken as edgeVerifySessionToken } from './session-edge';
import type { SessionValidationResult } from '@/types/auth';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_SECONDS = 30 * 60; // 30 minutes

export { edgeCreateSessionToken as createSessionToken, edgeVerifySessionToken as verifySessionToken };

export async function getSessionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export async function validateSession(token: string): Promise<SessionValidationResult> {
  const payload = await edgeVerifySessionToken(token);
  if (!payload) {
    return { valid: false };
  }

  const [rows] = await pool.execute<
    Array<
      RowDataPacket & {
        id: number;
        admin_id: number;
        username: string;
        display_name: string | null;
        expires_at: string;
      }
    >
  >(
    `SELECT s.id, s.admin_id, a.username, a.display_name, s.expires_at
     FROM sessions s
     JOIN admin_accounts a ON a.id = s.admin_id
     WHERE s.session_token = ? AND s.expires_at > NOW() AND a.is_active = TRUE
     LIMIT 1`,
    [payload.sessionId]
  );

  if (!rows || rows.length === 0) {
    return { valid: false };
  }

  const row = rows[0];
  return {
    valid: true,
    admin: {
      id: row.admin_id,
      username: row.username,
      display_name: row.display_name,
    },
    expires_at: new Date(row.expires_at),
  };
}

export async function refreshSessionActivity(sessionToken: string): Promise<void> {
  try {
    await pool.execute(
      'UPDATE sessions SET last_activity_at = NOW() WHERE session_token = ? AND expires_at > NOW()',
      [sessionToken]
    );
  } catch {
    // Non-blocking: session refresh failures should not break the request
  }
}
