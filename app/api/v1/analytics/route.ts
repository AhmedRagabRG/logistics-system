import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getAnalytics } from '@/lib/db-queries';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    const data = await getAnalytics(fromDate, toDate);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } },
      { status: 500 }
    );
  }
}
