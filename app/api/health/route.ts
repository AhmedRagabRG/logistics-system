import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Health check endpoint for server monitoring and uptime checks.
 * Returns 200 if app + database are healthy.
 * Returns 503 if any critical service is down.
 *
 * Usage: curl https://test.tadfoq.com/api/health
 */
export async function GET() {
  const checks: Record<string, { status: 'ok' | 'fail'; response_time_ms: number; error?: string }> = {};
  let allHealthy = true;

  // Check 1: Database connectivity
  const dbStart = Date.now();
  try {
    const [rows] = await pool.execute('SELECT 1 as health');
    checks.database = {
      status: 'ok',
      response_time_ms: Date.now() - dbStart,
    };
  } catch (err: any) {
    checks.database = {
      status: 'fail',
      response_time_ms: Date.now() - dbStart,
      error: err.message || 'Database connection failed',
    };
    allHealthy = false;
  }

  // Check 2: Essential tables exist
  const tablesStart = Date.now();
  try {
    const [tableRows] = await pool.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME IN ('quotes', 'shipment_requests', 'vendors', 'rfq_records', 'system_settings')`
    );
    const foundTables = (tableRows as any[]).map((r) => r.TABLE_NAME);
    const requiredTables = ['quotes', 'shipment_requests', 'vendors', 'rfq_records', 'system_settings'];
    const missingTables = requiredTables.filter((t) => !foundTables.includes(t));

    if (missingTables.length === 0) {
      checks.tables = {
        status: 'ok',
        response_time_ms: Date.now() - tablesStart,
      };
    } else {
      checks.tables = {
        status: 'fail',
        response_time_ms: Date.now() - tablesStart,
        error: `Missing tables: ${missingTables.join(', ')}`,
      };
      allHealthy = false;
    }
  } catch (err: any) {
    checks.tables = {
      status: 'fail',
      response_time_ms: Date.now() - tablesStart,
      error: err.message || 'Table check failed',
    };
    allHealthy = false;
  }

  const status = allHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      checks,
    },
    { status }
  );
}
