import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromCookie, validateSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const token = await getSessionFromCookie();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await validateSession(token);
  if (!session.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  let sql = 'SELECT id, contact_id, contact_channel, reply_text, parsed_price, parsed_currency, status, matched_rfq_id, resolution_notes, created_at, resolved_at FROM unmatched_vendor_replies';
  let countSql = 'SELECT COUNT(*) as total FROM unmatched_vendor_replies';
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (status && ['unmatched', 'resolved', 'ignored'].includes(status)) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (fromDate) {
    conditions.push('created_at >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('created_at <= ?');
    params.push(`${toDate} 23:59:59`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  if (whereClause) {
    sql += ` ${whereClause}`;
    countSql += ` ${whereClause}`;
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  // Use query (text mode) instead of execute (prepared statement) to avoid LIMIT/OFFSET parameter issues
  const [countRows] = await pool.query(countSql, params.length > 0 ? params : undefined);
  const total = (countRows as { total: number }[])[0]?.total ?? 0;

  const [rows] = await pool.query(sql, [...params, limit, offset]);

  return NextResponse.json({
    replies: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function PATCH(request: NextRequest) {
  const token = await getSessionFromCookie();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await validateSession(token);
  if (!session.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'number' || !['resolved', 'ignored'].includes(body.status)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  await pool.execute(
    `UPDATE unmatched_vendor_replies
     SET status = ?, resolution_notes = ?, resolved_at = NOW()
     WHERE id = ?`,
    [body.status, body.resolution_notes ?? null, body.id]
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const token = await getSessionFromCookie();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await validateSession(token);
  if (!session.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  await pool.execute('DELETE FROM unmatched_vendor_replies WHERE id = ?', [parseInt(id, 10)]);
  return NextResponse.json({ success: true });
}
