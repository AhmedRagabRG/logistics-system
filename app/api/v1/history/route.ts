import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-auth';
import type { RowDataPacket } from 'mysql2/promise';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const eventType = searchParams.get('event_type');
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const language = searchParams.get('language');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (fromDate) {
      conditions.push('l.created_at >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('l.created_at <= ?');
      params.push(`${toDate} 23:59:59`);
    }
    if (eventType) {
      conditions.push('l.event_type = ?');
      params.push(eventType);
    }

    let joinClause = '';
    if (status || channel || language) {
      joinClause = 'LEFT JOIN quotes q ON q.id = l.quote_id LEFT JOIN shipment_requests s ON s.id = q.shipment_request_id';
      if (status) {
        conditions.push('q.status = ?');
        params.push(status);
      }
      if (channel) {
        conditions.push('s.channel = ?');
        params.push(channel);
      }
      if (language) {
        conditions.push('s.language = ?');
        params.push(language);
      }
    }

    if (search) {
      conditions.push('(l.event_type LIKE ? OR a.username LIKE ? OR a.display_name LIKE ? OR l.details LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM system_logs l LEFT JOIN admin_accounts a ON a.id = l.admin_id ${joinClause} ${whereClause}`;
    const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(countQuery, params);
    const total = countRows[0]?.total ?? 0;

    const query = `
      SELECT l.id, l.event_type, l.admin_id, l.details, l.created_at,
             a.username as admin_username, a.display_name as admin_display_name
      FROM system_logs l
      LEFT JOIN admin_accounts a ON a.id = l.admin_id
      ${joinClause}
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await pool.query<
      Array<
        RowDataPacket & {
          id: number;
          event_type: string;
          admin_id: number | null;
          details: string | null;
          created_at: string;
          admin_username: string | null;
          admin_display_name: string | null;
        }
      >
    >(query, params);

    const events = (rows || []).map((row) => {
      let parsedDetails: Record<string, unknown> | null = null;
      if (row.details) {
        try {
          parsedDetails = JSON.parse(row.details);
        } catch {
          parsedDetails = null;
        }
      }
      return {
        id: row.id,
        event_type: row.event_type,
        admin: row.admin_id
          ? {
              id: row.admin_id,
              username: row.admin_username,
              display_name: row.admin_display_name,
            }
          : null,
        details: parsedDetails,
        created_at: row.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: { events, pagination: { page, limit, total } },
    });
  } catch (error) {
    console.error('History error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch history' } },
      { status: 500 }
    );
  }
}


