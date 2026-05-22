import { NextRequest, NextResponse } from 'next/server';
import { processExpiredRFQs } from '@/lib/automation-engine';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSystemPausedState } from '@/lib/toggle';

/**
 * RFQ Timeout Processor
 * 
 * This endpoint checks for RFQs that have passed their waiting period
 * and automatically processes them (selects lowest vendor bid).
 * 
 * Call this endpoint via a cron job or scheduler:
 * GET /api/v1/rfqs/process-timeouts
 * 
 * In Vercel, use vercel.json cron jobs.
 * In other environments, use a cron scheduler (e.g. node-cron, system cron).
 */
export async function GET(request: NextRequest) {
  // Optional: require admin session or API key for security
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  
  // Allow either admin session or API key
  if (apiKey !== process.env.AUTH_TOKEN) {
    const auth = await requireAdminSession(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key or session' } },
        { status: 401 }
      );
    }
  }

  try {
    const isPaused = await getSystemPausedState();
    const result = await processExpiredRFQs(isPaused);

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        paused: isPaused,
        results: result.results,
      },
    });
  } catch (error) {
    console.error('RFQ timeout processing error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process RFQ timeouts' } },
      { status: 500 }
    );
  }
}
