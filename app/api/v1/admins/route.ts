import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth';
import { requireAdminSession } from '@/lib/admin-auth';
import { verifySessionToken } from '@/lib/session-edge';
import { logAuthEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/ip';

type AdminRow = RowDataPacket & {
  id: number;
  username: string;
  display_name: string | null;
  password_hash?: string;
  is_active: number | boolean;
  active_sessions?: number;
  created_at: string;
  updated_at: string;
};

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters.')
  .max(64, 'Username must be 64 characters or fewer.')
  .regex(/^[A-Za-z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens.')
  .transform((value) => value.toLowerCase());

const createAdminSchema = z
  .object({
    username: usernameSchema,
    display_name: z.string().trim().max(128).optional().nullable(),
    password: z.string().min(1),
    confirm_password: z.string().min(1),
    is_active: z.boolean().default(true),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

const updateAdminSchema = z.object({
  display_name: z.string().trim().max(128).optional().nullable(),
  is_active: z.boolean().optional(),
});

const resetPasswordSchema = z
  .object({
    action: z.literal('reset_password'),
    password: z.string().min(1),
    confirm_password: z.string().min(1),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

const changePasswordSchema = z
  .object({
    action: z.literal('change_password'),
    current_password: z.string().min(1),
    password: z.string().min(1),
    confirm_password: z.string().min(1),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

function jsonError(code: string, message: string, status: number, details?: Array<{ field: string; message: string }>) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

function validationDetails(parse: { error: z.ZodError }) {
  return parse.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

function passwordValidationError(password: string, username?: string) {
  const errors = validatePasswordStrength(password, username);
  if (errors.length === 0) return null;

  return jsonError(
    'VALIDATION_ERROR',
    'Password does not meet security requirements',
    400,
    errors.map((message) => ({ field: 'password', message }))
  );
}

function getId(url: URL): number | null {
  const raw = url.searchParams.get('id');
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

async function getCurrentSessionId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  return payload?.sessionId ?? null;
}

async function getAdminById(id: number): Promise<AdminRow | null> {
  const [rows] = await pool.execute<AdminRow[]>(
    `SELECT id, username, display_name, password_hash, is_active, created_at, updated_at
     FROM admin_accounts
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

async function revokeAdminSessions(adminId: number, keepSessionId?: string | null): Promise<void> {
  if (keepSessionId) {
    await pool.execute('DELETE FROM sessions WHERE admin_id = ? AND session_token <> ?', [adminId, keepSessionId]);
    return;
  }

  await pool.execute('DELETE FROM sessions WHERE admin_id = ?', [adminId]);
}

async function activeAdminCount(): Promise<number> {
  const [rows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    'SELECT COUNT(*) AS total FROM admin_accounts WHERE is_active = TRUE'
  );
  return rows[0]?.total ?? 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const [rows] = await pool.execute<AdminRow[]>(
      `SELECT a.id, a.username, a.display_name, a.is_active, a.created_at, a.updated_at,
              COUNT(s.id) AS active_sessions
       FROM admin_accounts a
       LEFT JOIN sessions s ON s.admin_id = a.id AND s.expires_at > NOW()
       GROUP BY a.id, a.username, a.display_name, a.is_active, a.created_at, a.updated_at
       ORDER BY a.is_active DESC, a.username ASC`
    );

    const admins = rows.map((row) => ({
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      is_active: Boolean(row.is_active),
      active_sessions: Number(row.active_sessions ?? 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json({ success: true, data: { admins, current_admin_id: auth.admin.id } });
  } catch (error) {
    console.error('Admins GET error:', error);
    return jsonError('INTERNAL_ERROR', 'Failed to load admins', 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('VALIDATION_ERROR', 'Invalid JSON body', 400);
  }

  const parse = createAdminSchema.safeParse(body);
  if (!parse.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid admin data', 400, validationDetails(parse));
  }

  const passwordError = passwordValidationError(parse.data.password, parse.data.username);
  if (passwordError) return passwordError;

  try {
    const passwordHash = await hashPassword(parse.data.password);
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO admin_accounts (username, password_hash, display_name, is_active)
       VALUES (?, ?, ?, ?)`,
      [
        parse.data.username,
        passwordHash,
        parse.data.display_name?.trim() || null,
        parse.data.is_active ? 1 : 0,
      ]
    );

    await logAuthEvent({
      event_type: 'admin_created',
      admin_id: auth.admin.id,
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent') ?? null,
      details: {
        target_admin_id: result.insertId,
        target_username: parse.data.username,
        is_active: parse.data.is_active,
      },
    });

    return NextResponse.json({ success: true, data: { id: result.insertId } }, { status: 201 });
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return jsonError('DUPLICATE_ADMIN', 'Username already exists', 409);
    }

    console.error('Admins POST error:', error);
    return jsonError('INTERNAL_ERROR', 'Failed to create admin', 500);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  const id = getId(new URL(request.url));
  if (!id) return jsonError('VALIDATION_ERROR', 'Missing or invalid id parameter', 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('VALIDATION_ERROR', 'Invalid JSON body', 400);
  }

  const parse = updateAdminSchema.safeParse(body);
  if (!parse.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid admin data', 400, validationDetails(parse));
  }

  if (parse.data.is_active === false && id === auth.admin.id) {
    return jsonError('VALIDATION_ERROR', 'You cannot deactivate your own account', 400);
  }

  try {
    const existing = await getAdminById(id);
    if (!existing) return jsonError('NOT_FOUND', 'Admin not found', 404);

    if (parse.data.is_active === false && Boolean(existing.is_active) && (await activeAdminCount()) <= 1) {
      return jsonError('VALIDATION_ERROR', 'At least one active admin is required', 400);
    }

    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    if (parse.data.display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(parse.data.display_name?.trim() || null);
    }

    if (parse.data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(parse.data.is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      return jsonError('VALIDATION_ERROR', 'No fields to update', 400);
    }

    values.push(id);
    await pool.execute<ResultSetHeader>(`UPDATE admin_accounts SET ${fields.join(', ')} WHERE id = ?`, values);

    if (parse.data.is_active === false) {
      await revokeAdminSessions(id);
    }

    await logAuthEvent({
      event_type: 'admin_updated',
      admin_id: auth.admin.id,
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent') ?? null,
      details: {
        target_admin_id: id,
        target_username: existing.username,
        changed_fields: Object.keys(parse.data),
      },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admins PUT error:', error);
    return jsonError('INTERNAL_ERROR', 'Failed to update admin', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('VALIDATION_ERROR', 'Invalid JSON body', 400);
  }

  const rawAction = typeof body === 'object' && body !== null && 'action' in body ? body.action : null;

  if (rawAction === 'change_password') {
    const parse = changePasswordSchema.safeParse(body);
    if (!parse.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid password data', 400, validationDetails(parse));
    }

    const currentAdmin = await getAdminById(auth.admin.id);
    if (!currentAdmin?.password_hash) {
      return jsonError('NOT_FOUND', 'Admin not found', 404);
    }

    const currentPasswordValid = await verifyPassword(parse.data.current_password, currentAdmin.password_hash);
    if (!currentPasswordValid) {
      return jsonError('INVALID_CURRENT_PASSWORD', 'Current password is incorrect', 403);
    }

    if (await verifyPassword(parse.data.password, currentAdmin.password_hash)) {
      return jsonError('VALIDATION_ERROR', 'New password must be different from the current password', 400);
    }

    const passwordError = passwordValidationError(parse.data.password, currentAdmin.username);
    if (passwordError) return passwordError;

    try {
      const passwordHash = await hashPassword(parse.data.password);
      await pool.execute<ResultSetHeader>('UPDATE admin_accounts SET password_hash = ? WHERE id = ?', [
        passwordHash,
        auth.admin.id,
      ]);

      await revokeAdminSessions(auth.admin.id, await getCurrentSessionId(request));

      await logAuthEvent({
        event_type: 'admin_password_changed',
        admin_id: auth.admin.id,
        ip_address: getClientIp(request),
        user_agent: request.headers.get('user-agent') ?? null,
        details: { target_admin_id: auth.admin.id },
      });

      return NextResponse.json({ success: true, data: { id: auth.admin.id } });
    } catch (error) {
      console.error('Admins PATCH change_password error:', error);
      return jsonError('INTERNAL_ERROR', 'Failed to change password', 500);
    }
  }

  if (rawAction === 'reset_password') {
    const id = getId(new URL(request.url));
    if (!id) return jsonError('VALIDATION_ERROR', 'Missing or invalid id parameter', 400);

    if (id === auth.admin.id) {
      return jsonError('VALIDATION_ERROR', 'Use change password for your own account', 400);
    }

    const parse = resetPasswordSchema.safeParse(body);
    if (!parse.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid password data', 400, validationDetails(parse));
    }

    const targetAdmin = await getAdminById(id);
    if (!targetAdmin) return jsonError('NOT_FOUND', 'Admin not found', 404);

    const passwordError = passwordValidationError(parse.data.password, targetAdmin.username);
    if (passwordError) return passwordError;

    try {
      const passwordHash = await hashPassword(parse.data.password);
      await pool.execute<ResultSetHeader>('UPDATE admin_accounts SET password_hash = ? WHERE id = ?', [
        passwordHash,
        id,
      ]);

      await revokeAdminSessions(id);

      await logAuthEvent({
        event_type: 'admin_password_reset',
        admin_id: auth.admin.id,
        ip_address: getClientIp(request),
        user_agent: request.headers.get('user-agent') ?? null,
        details: {
          target_admin_id: id,
          target_username: targetAdmin.username,
        },
      });

      return NextResponse.json({ success: true, data: { id } });
    } catch (error) {
      console.error('Admins PATCH reset_password error:', error);
      return jsonError('INTERNAL_ERROR', 'Failed to reset password', 500);
    }
  }

  return jsonError('VALIDATION_ERROR', 'Unknown action', 400);
}
