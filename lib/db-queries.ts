import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

// ─── Analytics ─────────────────────────────────────────────────────────────

export interface AnalyticsData {
  summary: {
    total_requests: number;
    total_quotes: number;
    pending_quotes: number;
    approved_quotes: number;
    rejected_quotes: number;
    ready_quotes: number;
    sent_quotes: number;
    avg_response_time_minutes: number | null;
    approval_rate_percent: number;
    total_revenue: number;
    active_vendors: number;
    unmatched_replies: number;
    open_rfqs: number;
    system_toggle: string;
  };
  channel_distribution: Array<{ channel: string; count: number }>;
  language_distribution: Array<{ language: string; count: number }>;
  daily_volume: Array<{ date: string; requests: number; quotes: number }>;
  rfq_status_breakdown: Array<{ status: string; count: number }>;
  coverage_breakdown: Array<{ type: string; count: number }>;
  top_routes: Array<{ origin: string; destination: string; count: number }>;
  recent_pending: Array<{
    id: number;
    origin_region: string;
    destination_region: string;
    final_price: number;
    currency: string;
    status: string;
    created_at: string;
    customer_name: string | null;
  }>;
  vendor_response_stats: {
    total_assignments: number;
    responded_count: number;
    response_rate_percent: number;
    avg_bid: number | null;
  };
}

export async function getAnalytics(
  fromDate?: string | null,
  toDate?: string | null
): Promise<AnalyticsData> {
  const dateParams: string[] = [];
  if (fromDate) dateParams.push(fromDate);
  if (toDate) dateParams.push(`${toDate} 23:59:59`);

  const dateCondition =
    fromDate && toDate
      ? `WHERE q.created_at >= ? AND q.created_at <= ?`
      : fromDate
      ? `WHERE q.created_at >= ?`
      : toDate
      ? `WHERE q.created_at <= ?`
      : 'WHERE 1=1';

  const [summaryRows] = await pool.execute<
    Array<
      RowDataPacket & {
        total_requests: number;
        total_quotes: number;
        pending_quotes: number;
        approved_quotes: number;
        rejected_quotes: number;
        ready_quotes: number;
        sent_quotes: number;
        avg_response_time_minutes: number | null;
        approval_rate_percent: number;
        total_revenue: number;
        active_vendors: number;
        unmatched_replies: number;
        open_rfqs: number;
        system_toggle: string;
      }
    >
  >(
    `SELECT
      (SELECT COUNT(*) FROM shipment_requests ${dateCondition.replace(/q\.created_at/g, 'created_at')}) as total_requests,
      (SELECT COUNT(*) FROM quotes ${dateCondition}) as total_quotes,
      (SELECT COUNT(*) FROM quotes ${dateCondition} AND status = 'pending') as pending_quotes,
      (SELECT COUNT(*) FROM quotes ${dateCondition} AND status = 'approved') as approved_quotes,
      (SELECT COUNT(*) FROM quotes ${dateCondition} AND status = 'rejected') as rejected_quotes,
      (SELECT COUNT(*) FROM quotes ${dateCondition} AND status = 'ready_to_send') as ready_quotes,
      (SELECT COUNT(*) FROM quotes ${dateCondition} AND status = 'sent') as sent_quotes,
      (SELECT AVG(TIMESTAMPDIFF(MINUTE, q.created_at, q.approved_at)) FROM quotes q ${dateCondition} AND q.status = 'approved' AND q.approved_at IS NOT NULL) as avg_response_time_minutes,
      (SELECT COALESCE(ROUND((COUNT(CASE WHEN status IN ('approved', 'sent') THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2), 0) FROM quotes ${dateCondition}) as approval_rate_percent,
      (SELECT COALESCE(SUM(final_price), 0) FROM quotes ${dateCondition} AND status IN ('approved', 'sent')) as total_revenue,
      (SELECT COUNT(*) FROM vendors WHERE is_active = 1) as active_vendors,
      (SELECT COUNT(*) FROM unmatched_vendor_replies WHERE status = 'unmatched') as unmatched_replies,
      (SELECT COUNT(*) FROM rfq_records WHERE status IN ('open', 'responded')) as open_rfqs,
      (SELECT master_logic_toggle FROM system_settings ORDER BY id DESC LIMIT 1) as system_toggle`,
    [...dateParams, ...dateParams, ...dateParams, ...dateParams, ...dateParams, ...dateParams, ...dateParams, ...dateParams, ...dateParams]
  );

  const summary = summaryRows[0];

  const [channelRows] = await pool.execute<
    Array<RowDataPacket & { channel: string; count: number }>
  >(
    `SELECT s.channel, COUNT(*) as count
     FROM shipment_requests s
     ${dateCondition.replace(/q\.created_at/g, 's.created_at')}
     GROUP BY s.channel
     ORDER BY count DESC`,
    [...dateParams]
  );

  const [languageRows] = await pool.execute<
    Array<RowDataPacket & { language: string; count: number }>
  >(
    `SELECT s.language, COUNT(*) as count
     FROM shipment_requests s
     ${dateCondition.replace(/q\.created_at/g, 's.created_at')}
     GROUP BY s.language
     ORDER BY count DESC`,
    [...dateParams]
  );

  const dailyFrom = fromDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dailyTo = toDate ?? new Date().toISOString().split('T')[0];
  const [dailyRows] = await pool.execute<
    Array<RowDataPacket & { date: string; requests: number; quotes: number }>
  >(
    `SELECT
      dates.date,
      COALESCE(req.count, 0) as requests,
      COALESCE(qu.count, 0) as quotes
    FROM (
      SELECT DATE(created_at) as date FROM shipment_requests WHERE created_at >= ? AND created_at <= ?
      UNION
      SELECT DATE(created_at) as date FROM quotes WHERE created_at >= ? AND created_at <= ?
    ) dates
    LEFT JOIN (SELECT DATE(created_at) as date, COUNT(*) as count FROM shipment_requests WHERE created_at >= ? AND created_at <= ? GROUP BY DATE(created_at)) req ON req.date = dates.date
    LEFT JOIN (SELECT DATE(created_at) as date, COUNT(*) as count FROM quotes WHERE created_at >= ? AND created_at <= ? GROUP BY DATE(created_at)) qu ON qu.date = dates.date
    ORDER BY dates.date DESC
    LIMIT 30`,
    [dailyFrom, `${dailyTo} 23:59:59`, dailyFrom, `${dailyTo} 23:59:59`, dailyFrom, `${dailyTo} 23:59:59`, dailyFrom, `${dailyTo} 23:59:59`]
  );

  // RFQ status breakdown
  const [rfqStatusRows] = await pool.execute<
    Array<RowDataPacket & { status: string; count: number }>
  >(
    `SELECT status, COUNT(*) as count FROM rfq_records GROUP BY status ORDER BY count DESC`
  );

  // Coverage breakdown: internal (has rfq_id but not no-vendors), RFQ (has rfq_id), no coverage, data request
  const [coverageRows] = await pool.execute<
    Array<RowDataPacket & { type: string; count: number }>
  >(
    `SELECT
      CASE
        WHEN review_reason LIKE '%No vendors%' THEN 'No Coverage'
        WHEN review_reason LIKE '%Missing fields%' THEN 'Data Request'
        WHEN rfq_id IS NOT NULL THEN 'RFQ'
        ELSE 'Internal Pricing'
      END as type,
      COUNT(*) as count
    FROM quotes
    GROUP BY type
    ORDER BY count DESC`
  );

  // Top routes
  const [topRouteRows] = await pool.execute<
    Array<RowDataPacket & { origin: string; destination: string; count: number }>
  >(
    `SELECT origin_region as origin, destination_region as destination, COUNT(*) as count
     FROM quotes
     GROUP BY origin_region, destination_region
     ORDER BY count DESC
     LIMIT 5`
  );

  // Recent pending quotes
  const [recentPendingRows] = await pool.execute<
    Array<
      RowDataPacket & {
        id: number;
        origin_region: string;
        destination_region: string;
        final_price: number;
        currency: string;
        status: string;
        created_at: string;
        customer_name: string | null;
      }
    >
  >(
    `SELECT q.id, q.origin_region, q.destination_region, q.final_price, q.currency, q.status, q.created_at, s.customer_name
     FROM quotes q
     JOIN shipment_requests s ON s.id = q.shipment_request_id
     WHERE q.status = 'pending'
     ORDER BY q.created_at DESC
     LIMIT 5`
  );

  // Vendor response stats
  const [vendorStatsRows] = await pool.execute<
    Array<
      RowDataPacket & {
        total_assignments: number;
        responded_count: number;
        avg_bid: number | null;
      }
    >
  >(
    `SELECT
      COUNT(*) as total_assignments,
      COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded_count,
      AVG(response_price) as avg_bid
    FROM rfq_vendor_assignments`
  );
  const vendorStats = vendorStatsRows[0];

  return {
    summary: {
      total_requests: summary.total_requests,
      total_quotes: summary.total_quotes,
      pending_quotes: summary.pending_quotes,
      approved_quotes: summary.approved_quotes,
      rejected_quotes: summary.rejected_quotes,
      ready_quotes: summary.ready_quotes,
      sent_quotes: summary.sent_quotes,
      avg_response_time_minutes: summary.avg_response_time_minutes,
      approval_rate_percent: summary.approval_rate_percent,
      total_revenue: summary.total_revenue,
      active_vendors: summary.active_vendors,
      unmatched_replies: summary.unmatched_replies,
      open_rfqs: summary.open_rfqs,
      system_toggle: summary.system_toggle,
    },
    channel_distribution: channelRows || [],
    language_distribution: languageRows || [],
    daily_volume: (dailyRows || []).map((row) => ({
      date: (row.date as unknown) instanceof Date ? (row.date as unknown as Date).toISOString().split('T')[0] : String(row.date),
      requests: row.requests,
      quotes: row.quotes,
    })),
    rfq_status_breakdown: rfqStatusRows || [],
    coverage_breakdown: coverageRows || [],
    top_routes: topRouteRows || [],
    recent_pending: recentPendingRows || [],
    vendor_response_stats: {
      total_assignments: vendorStats.total_assignments,
      responded_count: vendorStats.responded_count,
      response_rate_percent: vendorStats.total_assignments > 0
        ? Math.round((vendorStats.responded_count / vendorStats.total_assignments) * 100)
        : 0,
      avg_bid: vendorStats.avg_bid,
    },
  };
}

// ─── Quotes ────────────────────────────────────────────────────────────────

export interface QuoteListItem {
  id: number;
  origin_region: string;
  destination_region: string;
  final_price: number;
  currency: string;
  status: string;
  transport_mode: string;
  is_oversize: boolean;
  is_dual_mode: boolean;
  rfq_id: number | null;
  review_reason: string | null;
  created_at: string;
  origin_postal_code: string | null;
  destination_postal_code: string | null;
  weight_kg: number | null;
  channel: string;
  language: string;
  customer_name: string | null;
}

export interface QuoteListResult {
  quotes: QuoteListItem[];
  pagination: { page: number; limit: number; total: number };
}

export async function getQuotes(filters: {
  status?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  channel?: string | null;
  language?: string | null;
  transportMode?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
}): Promise<QuoteListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.status) {
    conditions.push('q.status = ?');
    params.push(filters.status);
  }
  if (filters.fromDate) {
    conditions.push('q.created_at >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    conditions.push('q.created_at <= ?');
    params.push(`${filters.toDate} 23:59:59`);
  }
  if (filters.channel) {
    conditions.push('s.channel = ?');
    params.push(filters.channel);
  }
  if (filters.language) {
    conditions.push('s.language = ?');
    params.push(filters.language);
  }
  if (filters.transportMode) {
    conditions.push('q.transport_mode = ?');
    params.push(filters.transportMode);
  }
  if (filters.search) {
    conditions.push('(s.customer_name LIKE ? OR q.origin_region LIKE ? OR q.destination_region LIKE ? OR q.currency LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like, like);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) as total FROM quotes q JOIN shipment_requests s ON s.id = q.shipment_request_id ${whereClause}`;
  const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(countQuery, params);
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT q.id, q.origin_region, q.destination_region, q.final_price, q.currency, q.status, q.transport_mode,
           q.is_oversize, q.is_dual_mode, q.rfq_id, q.review_reason, q.created_at, q.origin_postal_code, q.destination_postal_code, q.weight_kg,
           s.channel, s.language, s.customer_name
    FROM quotes q
    JOIN shipment_requests s ON s.id = q.shipment_request_id
    ${whereClause}
    ORDER BY q.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.query<
    Array<
      RowDataPacket & {
        id: number;
        origin_region: string;
        destination_region: string;
        final_price: number;
        currency: string;
        status: string;
        transport_mode: string;
        is_oversize: boolean;
        is_dual_mode: boolean;
        rfq_id: number | null;
        review_reason: string | null;
        created_at: string;
        origin_postal_code: string | null;
        destination_postal_code: string | null;
        weight_kg: number | null;
        channel: string;
        language: string;
        customer_name: string | null;
      }
    >
  >(query, params);

  return {
    quotes: (rows || []).map((row) => ({
      id: row.id,
      origin_region: row.origin_region,
      destination_region: row.destination_region,
      final_price: row.final_price,
      currency: row.currency,
      status: row.status,
      transport_mode: row.transport_mode,
      is_oversize: row.is_oversize,
      is_dual_mode: row.is_dual_mode,
      rfq_id: row.rfq_id,
      review_reason: row.review_reason,
      created_at: row.created_at,
      origin_postal_code: row.origin_postal_code,
      destination_postal_code: row.destination_postal_code,
      weight_kg: row.weight_kg,
      channel: row.channel,
      language: row.language,
      customer_name: row.customer_name,
    })),
    pagination: { page, limit, total },
  };
}

// ─── RFQs ──────────────────────────────────────────────────────────────────

export interface RFQItem {
  id: number;
  quote_id: number;
  rfq_reference: string;
  target_country: string;
  status: string;
  origin_region: string;
  destination_region: string;
  vendor_count: number;
  created_at: string;
  updated_at: string;
}

export interface RFQListResult {
  rfqs: RFQItem[];
  pagination: { page: number; limit: number; total: number };
}

export async function getRFQs(filters: {
  status?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
}): Promise<RFQListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.status) {
    conditions.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.fromDate) {
    conditions.push('r.created_at >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    conditions.push('r.created_at <= ?');
    params.push(`${filters.toDate} 23:59:59`);
  }
  if (filters.search) {
    conditions.push('(q.origin_region LIKE ? OR q.destination_region LIKE ? OR r.target_country LIKE ? OR r.rfq_reference LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like, like);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) as total FROM rfq_records r JOIN quotes q ON q.id = r.quote_id ${whereClause}`;
  const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(countQuery, params);
  const total = countRows[0]?.total ?? 0;

  const [rows] = await pool.query<
    Array<
      RowDataPacket & {
        id: number;
        quote_id: number;
        rfq_reference: string;
        target_country: string;
        status: string;
        created_at: string;
        updated_at: string;
        origin_region: string;
        destination_region: string;
        vendor_count: number;
      }
    >
  >(
    `SELECT r.id, r.quote_id, r.rfq_reference, r.target_country, r.status,
            r.created_at, r.updated_at, q.origin_region, q.destination_region,
            (SELECT COUNT(*) FROM rfq_vendor_assignments a WHERE a.rfq_id = r.id) as vendor_count
     FROM rfq_records r
     JOIN quotes q ON q.id = r.quote_id
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const rfqs = (rows || []).map((row) => ({
    id: row.id,
    quote_id: row.quote_id,
    rfq_reference: row.rfq_reference,
    target_country: row.target_country,
    status: row.status,
    origin_region: row.origin_region,
    destination_region: row.destination_region,
    vendor_count: row.vendor_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return { rfqs, pagination: { page, limit, total } };
}

// ─── System Status ─────────────────────────────────────────────────────────

export interface SystemStatusData {
  table_counts: {
    vendors: number;
    active_vendors: number;
    route_pricing: number;
    postal_codes: number;
    countries: number;
    active_countries: number;
    exchange_rates: number;
    quotes: number;
    shipment_requests: number;
  };
  config_status: {
    whatsapp_configured: boolean;
    telegram_configured: boolean;
    email_n8n_configured: boolean;
    email_smtp_configured: boolean;
    openai_configured: boolean;
    db_connected: boolean;
  };
  warnings: string[];
}

export async function getSystemStatus(): Promise<SystemStatusData> {
  const [vendorRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total, SUM(is_active) as active FROM vendors`);
  const [pricingRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM route_pricing`);
  const [postalRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM postal_codes`);
  const [countryRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total, SUM(is_active) as active FROM countries`);
  const [rateRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM exchange_rates`);
  const [quoteRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM quotes`);
  const [requestRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM shipment_requests`);

  const table_counts = {
    vendors: Number(vendorRows[0]?.total ?? 0),
    active_vendors: Number(vendorRows[0]?.active ?? 0),
    route_pricing: Number(pricingRows[0]?.total ?? 0),
    postal_codes: Number(postalRows[0]?.total ?? 0),
    countries: Number(countryRows[0]?.total ?? 0),
    active_countries: Number(countryRows[0]?.active ?? 0),
    exchange_rates: Number(rateRows[0]?.total ?? 0),
    quotes: Number(quoteRows[0]?.total ?? 0),
    shipment_requests: Number(requestRows[0]?.total ?? 0),
  };

  const config_status = {
    whatsapp_configured: !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    telegram_configured: !!process.env.TELEGRAM_BOT_TOKEN,
    email_n8n_configured: !!process.env.N8N_EMAIL_WEBHOOK_URL,
    email_smtp_configured: !!process.env.SMTP_HOST && !!process.env.SMTP_USER,
    openai_configured: !!process.env.OPENAI_API_KEY,
    db_connected: true,
  };

  const warnings: string[] = [];
  if (table_counts.active_vendors === 0) warnings.push('No active vendors found. Add vendors in Master Data > Vendors.');
  if (table_counts.route_pricing === 0) warnings.push('No route pricing found. Import pricing data in Master Data > Import.');
  if (table_counts.postal_codes === 0) warnings.push('No postal codes found. Import postal code data in Master Data > Import.');
  if (table_counts.active_countries === 0) warnings.push('No active countries found. Add countries in Master Data > Countries.');
  if (table_counts.exchange_rates === 0) warnings.push('No exchange rates found. Add rates in Master Data > Exchange Rates.');
  if (!config_status.whatsapp_configured) warnings.push('WhatsApp not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.local.');
  if (!config_status.telegram_configured) warnings.push('Telegram not configured. Set TELEGRAM_BOT_TOKEN in .env.local.');
  if (!config_status.email_n8n_configured && !config_status.email_smtp_configured) warnings.push('Email not configured. Set N8N_EMAIL_WEBHOOK_URL (preferred) or SMTP_HOST/SMTP_USER in .env.local.');
  if (!config_status.openai_configured) warnings.push('OpenAI not configured. Set OPENAI_API_KEY in .env.local.');

  return { table_counts, config_status, warnings };
}
