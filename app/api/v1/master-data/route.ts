import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  vendorSchema,
  routePricingSchema,
  systemSettingsSchema,
  exchangeRateSchema,
} from '@/lib/validation';
import { invalidateToggleCache } from '@/lib/toggle';
import { requireAdminSession } from '@/lib/admin-auth';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

// ─── Helpers ───────────────────────────────────────────────────────────────

function getResource(url: URL): string | null {
  return url.searchParams.get('resource');
}

function getId(url: URL): number | null {
  const raw = url.searchParams.get('id');
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
}

function stripEmptyStrings(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === '') {
      continue;
    }
    result[key] = value;
  }
  return result;
}

// ─── Vendors ───────────────────────────────────────────────────────────────

async function listVendors() {
  const [rows] = await pool.execute<
    Array<RowDataPacket>
  >('SELECT * FROM vendors ORDER BY priority_ranking ASC, id ASC');
  const vendors = (rows || []).map((row) => ({
    ...row,
    preferred_channels:
      typeof row.preferred_channels === 'string'
        ? JSON.parse(row.preferred_channels)
        : row.preferred_channels ?? [],
  }));
  return NextResponse.json({ success: true, data: { vendors } });
}

async function createVendor(body: unknown) {
  const parse = vendorSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid vendor data',
          details: parse.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 }
    );
  }
  const data = parse.data;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO vendors (name, country_coverage, city, expertise_notes, priority_ranking, use_custom_margin, margin_rate, contact_email, contact_phone, telegram_chat_id, preferred_channels, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.country_coverage,
      data.city ?? null,
      data.expertise_notes ?? null,
      data.priority_ranking,
      data.use_custom_margin ? 1 : 0,
      data.margin_rate,
      data.contact_email ?? null,
      data.contact_phone ?? null,
      data.telegram_chat_id ?? null,
      JSON.stringify(data.preferred_channels),
      data.is_active,
    ]
  );
  return NextResponse.json({ success: true, data: { id: result.insertId } });
}

async function updateVendor(id: number, body: unknown) {
  const parse = vendorSchema.partial().safeParse(
    typeof body === 'object' && body !== null ? stripEmptyStrings(body as Record<string, unknown>) : body
  );
  if (!parse.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid vendor data',
          details: parse.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 }
    );
  }
  const data = parse.data;
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.country_coverage !== undefined) { fields.push('country_coverage = ?'); values.push(data.country_coverage); }
  if (data.city !== undefined) { fields.push('city = ?'); values.push(data.city ?? null); }
  if (data.expertise_notes !== undefined) { fields.push('expertise_notes = ?'); values.push(data.expertise_notes ?? null); }
  if (data.priority_ranking !== undefined) { fields.push('priority_ranking = ?'); values.push(data.priority_ranking); }
  if (data.use_custom_margin !== undefined) { fields.push('use_custom_margin = ?'); values.push(data.use_custom_margin ? 1 : 0); }
  if (data.margin_rate !== undefined) { fields.push('margin_rate = ?'); values.push(data.margin_rate); }
  if (data.contact_email !== undefined) { fields.push('contact_email = ?'); values.push(data.contact_email ?? null); }
  if (data.contact_phone !== undefined) { fields.push('contact_phone = ?'); values.push(data.contact_phone ?? null); }
  if (data.telegram_chat_id !== undefined) { fields.push('telegram_chat_id = ?'); values.push(data.telegram_chat_id ?? null); }
  if (data.preferred_channels !== undefined) { fields.push('preferred_channels = ?'); values.push(JSON.stringify(data.preferred_channels)); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }

  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 });
  }

  values.push(id);
  await pool.execute(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`, values);
  return NextResponse.json({ success: true, data: { id } });
}

async function deleteVendor(id: number) {
  await pool.execute('DELETE FROM vendors WHERE id = ?', [id]);
  return NextResponse.json({ success: true, data: { id } });
}

async function deleteVendors(ids: number[]) {
  const placeholders = ids.map(() => '?').join(',');
  await pool.execute(`DELETE FROM vendors WHERE id IN (${placeholders})`, ids);
  return NextResponse.json({ success: true, data: { deleted: ids.length } });
}

// ─── Route Pricing ─────────────────────────────────────────────────────────

async function listPricing() {
  const [rows] = await pool.execute<
    Array<RowDataPacket>
  >('SELECT * FROM route_pricing ORDER BY origin_region, destination_region');
  return NextResponse.json({ success: true, data: { pricing: rows || [] } });
}

async function createPricing(body: unknown) {
  const parse = routePricingSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pricing data',
          details: parse.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 }
    );
  }
  const data = parse.data;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO route_pricing (origin_region, destination_region, base_price, markup_percent, currency, is_sea_active, sea_base_price, sea_markup_percent, sea_currency, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.origin_region,
      data.destination_region,
      data.base_price,
      data.markup_percent,
      data.currency,
      data.is_sea_active,
      data.sea_base_price,
      data.sea_markup_percent,
      data.sea_currency,
      data.is_active,
    ]
  );
  return NextResponse.json({ success: true, data: { id: result.insertId } });
}

async function updatePricing(id: number, body: unknown) {
  const parse = routePricingSchema.partial().safeParse(
    typeof body === 'object' && body !== null ? stripEmptyStrings(body as Record<string, unknown>) : body
  );
  if (!parse.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pricing data',
          details: parse.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 }
    );
  }
  const data = parse.data;
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  if (data.origin_region !== undefined) { fields.push('origin_region = ?'); values.push(data.origin_region); }
  if (data.destination_region !== undefined) { fields.push('destination_region = ?'); values.push(data.destination_region); }
  if (data.base_price !== undefined) { fields.push('base_price = ?'); values.push(data.base_price); }
  if (data.markup_percent !== undefined) { fields.push('markup_percent = ?'); values.push(data.markup_percent); }
  if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
  if (data.is_sea_active !== undefined) { fields.push('is_sea_active = ?'); values.push(data.is_sea_active); }
  if (data.sea_base_price !== undefined) { fields.push('sea_base_price = ?'); values.push(data.sea_base_price); }
  if (data.sea_markup_percent !== undefined) { fields.push('sea_markup_percent = ?'); values.push(data.sea_markup_percent); }
  if (data.sea_currency !== undefined) { fields.push('sea_currency = ?'); values.push(data.sea_currency); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }

  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 });
  }

  values.push(id);
  await pool.execute(`UPDATE route_pricing SET ${fields.join(', ')} WHERE id = ?`, values);
  return NextResponse.json({ success: true, data: { id } });
}

async function deletePricing(id: number) {
  await pool.execute('DELETE FROM route_pricing WHERE id = ?', [id]);
  return NextResponse.json({ success: true, data: { id } });
}

async function deletePricings(ids: number[]) {
  const placeholders = ids.map(() => '?').join(',');
  await pool.execute(`DELETE FROM route_pricing WHERE id IN (${placeholders})`, ids);
  return NextResponse.json({ success: true, data: { deleted: ids.length } });
}

// ─── System Settings ───────────────────────────────────────────────────────

async function getSettings() {
  const [rows] = await pool.execute<
    Array<RowDataPacket>
  >('SELECT * FROM system_settings ORDER BY id DESC LIMIT 1');
  const settings = rows && rows.length > 0 ? rows[0] : null;
  return NextResponse.json({ success: true, data: { settings } });
}

async function updateSettings(body: unknown) {
  const parse = systemSettingsSchema.partial().safeParse(
    typeof body === 'object' && body !== null ? stripEmptyStrings(body as Record<string, unknown>) : body
  );
  if (!parse.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid settings data',
          details: parse.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 }
    );
  }
  const data = parse.data;
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.master_logic_toggle !== undefined) { fields.push('master_logic_toggle = ?'); values.push(data.master_logic_toggle); }
  if (data.default_currency !== undefined) { fields.push('default_currency = ?'); values.push(data.default_currency); }
  if (data.oversize_weight_threshold_tons !== undefined) { fields.push('oversize_weight_threshold_tons = ?'); values.push(data.oversize_weight_threshold_tons); }
  if (data.waiting_period !== undefined) { fields.push('waiting_period = ?'); values.push(data.waiting_period); }
  if (data.global_markup_percent !== undefined) { fields.push('global_markup_percent = ?'); values.push(data.global_markup_percent); }
  if (data.vendor_msg_email !== undefined) { fields.push('vendor_msg_email = ?'); values.push(data.vendor_msg_email ?? null); }
  if (data.vendor_msg_telegram !== undefined) { fields.push('vendor_msg_telegram = ?'); values.push(data.vendor_msg_telegram ?? null); }
  if (data.vendor_msg_whatsapp !== undefined) { fields.push('vendor_msg_whatsapp = ?'); values.push(data.vendor_msg_whatsapp ?? null); }

  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 });
  }

  // Ensure a settings row exists (always use the latest row)
  const [existing] = await pool.execute<Array<RowDataPacket>>('SELECT id FROM system_settings ORDER BY id DESC LIMIT 1');
  if (!existing || existing.length === 0) {
    await pool.execute(
      `INSERT INTO system_settings (master_logic_toggle, default_currency, oversize_weight_threshold_tons, waiting_period, global_markup_percent, vendor_msg_email, vendor_msg_telegram, vendor_msg_whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.master_logic_toggle ?? 'manual_approval', data.default_currency ?? 'TRY', data.oversize_weight_threshold_tons ?? 22.00, data.waiting_period ?? '30m', data.global_markup_percent ?? 0, data.vendor_msg_email ?? null, data.vendor_msg_telegram ?? null, data.vendor_msg_whatsapp ?? null]
    );
  } else {
    values.push(existing[0].id);
    await pool.execute(`UPDATE system_settings SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  invalidateToggleCache();
  return NextResponse.json({ success: true, data: { updated: true } });
}

// ─── Exchange Rates ────────────────────────────────────────────────────────

async function listRates() {
  const [rows] = await pool.execute<
    Array<RowDataPacket>
  >('SELECT * FROM exchange_rates ORDER BY effective_date DESC, from_currency, to_currency');
  return NextResponse.json({ success: true, data: { rates: rows || [] } });
}

async function createRate(body: unknown) {
  const parse = exchangeRateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid rate data',
          details: parse.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 }
    );
  }
  const data = parse.data;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
     VALUES (?, ?, ?, ?)`,
    [data.from_currency, data.to_currency, data.rate, data.effective_date]
  );
  return NextResponse.json({ success: true, data: { id: result.insertId } });
}

async function updateRate(id: number, body: unknown) {
  const parse = exchangeRateSchema.partial().safeParse(
    typeof body === 'object' && body !== null ? stripEmptyStrings(body as Record<string, unknown>) : body
  );
  if (!parse.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid rate data',
          details: parse.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 }
    );
  }
  const data = parse.data;
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.from_currency !== undefined) { fields.push('from_currency = ?'); values.push(data.from_currency); }
  if (data.to_currency !== undefined) { fields.push('to_currency = ?'); values.push(data.to_currency); }
  if (data.rate !== undefined) { fields.push('rate = ?'); values.push(data.rate); }
  if (data.effective_date !== undefined) { fields.push('effective_date = ?'); values.push(data.effective_date); }

  if (fields.length === 0) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 });
  }

  values.push(id);
  await pool.execute(`UPDATE exchange_rates SET ${fields.join(', ')} WHERE id = ?`, values);
  return NextResponse.json({ success: true, data: { id } });
}

async function deleteRate(id: number) {
  await pool.execute('DELETE FROM exchange_rates WHERE id = ?', [id]);
  return NextResponse.json({ success: true, data: { id } });
}

async function deleteRates(ids: number[]) {
  const placeholders = ids.map(() => '?').join(',');
  await pool.execute(`DELETE FROM exchange_rates WHERE id IN (${placeholders})`, ids);
  return NextResponse.json({ success: true, data: { deleted: ids.length } });
}

// ─── Main Handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const url = new URL(request.url);
    const resource = getResource(url);

    switch (resource) {
      case 'vendors':
        return await listVendors();
      case 'pricing':
        return await listPricing();
      case 'settings':
        return await getSettings();
      case 'rates':
        return await listRates();
      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown resource. Use ?resource=vendors|pricing|settings|rates' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Master data GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch master data' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const url = new URL(request.url);
    const resource = getResource(url);
    const body = await request.json();

    switch (resource) {
      case 'vendors':
        return await createVendor(body);
      case 'pricing':
        return await createPricing(body);
      case 'rates':
        return await createRate(body);
      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown resource for POST. Use ?resource=vendors|pricing|rates' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Master data POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create master data' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const url = new URL(request.url);
    const resource = getResource(url);
    const id = getId(url);
    const body = await request.json();

    if (resource !== 'settings' && id === null) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing id parameter' } },
        { status: 400 }
      );
    }

    switch (resource) {
      case 'vendors':
        return await updateVendor(id!, body);
      case 'pricing':
        return await updatePricing(id!, body);
      case 'settings':
        return await updateSettings(body);
      case 'rates':
        return await updateRate(id!, body);
      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown resource for PUT. Use ?resource=vendors|pricing|settings|rates' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Master data PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update master data' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const url = new URL(request.url);
    const resource = getResource(url);
    const idsParam = url.searchParams.get('ids');

    if (idsParam) {
      const ids = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
      if (ids.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid ids parameter' } },
          { status: 400 }
        );
      }
      switch (resource) {
        case 'vendors':
          return await deleteVendors(ids);
        case 'pricing':
          return await deletePricings(ids);
        case 'rates':
          return await deleteRates(ids);
        default:
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown resource for DELETE' } },
            { status: 400 }
          );
      }
    }

    const id = getId(url);
    if (id === null) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing id or ids parameter' } },
        { status: 400 }
      );
    }

    switch (resource) {
      case 'vendors':
        return await deleteVendor(id);
      case 'pricing':
        return await deletePricing(id);
      case 'rates':
        return await deleteRate(id);
      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown resource for DELETE. Use ?resource=vendors|pricing|rates' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Master data DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete master data' } },
      { status: 500 }
    );
  }
}
