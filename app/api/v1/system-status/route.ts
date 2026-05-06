import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/db-queries';

export async function GET() {
  try {
    const status = await getSystemStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch system status';
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
