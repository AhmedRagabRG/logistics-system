import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './session-edge';
import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

export async function requireAdminSession(request: NextRequest): Promise<{
  success: true;
  admin: { id: number; username: string; display_name: string | null };
} | {
  success: false;
  response: NextResponse;
}> {
  const token = request.cookies.get('session')?.value;
  if (!token) {
    return { success: false, response: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Oturum gerekli' } }, { status: 401 }) };
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return { success: false, response: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Gecersiz oturum' } }, { status: 401 }) };
  }

  const [rows] = await pool.execute<
    Array<RowDataPacket & { admin_id: number; username: string; display_name: string | null }>
  >(
    `SELECT s.admin_id, a.username, a.display_name
     FROM sessions s
     JOIN admin_accounts a ON a.id = s.admin_id
     WHERE s.session_token = ? AND s.expires_at > NOW() AND a.is_active = TRUE
     LIMIT 1`,
    [payload.sessionId]
  );

  if (!rows || rows.length === 0) {
    return { success: false, response: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Oturum sona erdi' } }, { status: 401 }) };
  }

  return {
    success: true,
    admin: {
      id: rows[0].admin_id,
      username: rows[0].username,
      display_name: rows[0].display_name,
    },
  };
}
