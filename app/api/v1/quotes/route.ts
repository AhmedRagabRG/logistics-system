import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getQuotes } from '@/lib/db-queries';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2/promise';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const channel = searchParams.get('channel');
    const language = searchParams.get('language');
    const transportMode = searchParams.get('transport_mode');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10)));

    const data = await getQuotes({ status, fromDate, toDate, channel, language, transportMode, search, page, limit });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Quotes list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch quotes' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    if (!idsParam) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing ids parameter' } },
        { status: 400 }
      );
    }
    const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid ids parameter' } },
        { status: 400 }
      );
    }

    // Delete related records first to avoid FK constraint issues
    const placeholders = ids.map(() => '?').join(',');
    await pool.execute(`DELETE FROM rfq_records WHERE quote_id IN (${placeholders})`, ids);
    await pool.execute<ResultSetHeader>(`DELETE FROM quotes WHERE id IN (${placeholders})`, ids);

    return NextResponse.json({ success: true, data: { deleted: ids.length } });
  } catch (error) {
    console.error('Quotes DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete quotes' } },
      { status: 500 }
    );
  }
}
