import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-auth';
import { parsePostalCodes, parseRoutePricing, parseVendors } from '@/lib/import-parsers';
import { logAuthEvent } from '@/lib/audit';
import type { ResultSetHeader } from 'mysql2/promise';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const importType = formData.get('type') as string | null;

    if (!file || !importType) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File and type are required' } },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let inserted = 0;
    let skipped = 0;

    switch (importType) {
      case 'postal_codes': {
        const rows = parsePostalCodes(buffer);
        for (const row of rows) {
          try {
            await pool.execute<ResultSetHeader>(
              `INSERT INTO postal_codes (country_code, prefix, region)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE region = VALUES(region)`,
              [row.country_code, row.prefix, row.region]
            );
            inserted++;
          } catch {
            skipped++;
          }
        }
        break;
      }

      case 'route_pricing': {
        const rows = parseRoutePricing(buffer);
        for (const row of rows) {
          try {
            await pool.execute<ResultSetHeader>(
              `INSERT INTO route_pricing (origin_region, destination_region, base_price, markup_percent, currency, is_sea_active, sea_base_price, sea_markup_percent, sea_currency, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
               ON DUPLICATE KEY UPDATE base_price = VALUES(base_price), markup_percent = VALUES(markup_percent), currency = VALUES(currency), is_sea_active = VALUES(is_sea_active), sea_base_price = VALUES(sea_base_price), sea_markup_percent = VALUES(sea_markup_percent), sea_currency = VALUES(sea_currency)`,
              [
                row.origin_region,
                row.destination_region,
                row.base_price,
                row.markup_percent,
                row.currency,
                row.is_sea_active,
                row.sea_base_price,
                row.sea_markup_percent,
                row.sea_currency,
              ]
            );
            inserted++;
          } catch {
            skipped++;
          }
        }
        break;
      }

      case 'vendors': {
        const rows = parseVendors(buffer);
        // Debug: log first 3 rows to help diagnose import issues
        console.log('[IMPORT DEBUG] Parsed', rows.length, 'vendor rows');
        for (let i = 0; i < Math.min(3, rows.length); i++) {
          const r = rows[i];
          console.log('[IMPORT DEBUG] Row', i + 1, ':', {
            name: r.name,
            country: r.country_coverage,
            city: r.city,
            email: r.contact_email,
            phone: r.contact_phone,
            telegram: r.telegram_chat_id,
          });
        }
        for (const row of rows) {
          try {
            await pool.execute<ResultSetHeader>(
              `INSERT INTO vendors (name, country_coverage, city, expertise_notes, contact_email, contact_phone, telegram_chat_id, preferred_channels, use_custom_margin, margin_rate, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
               ON DUPLICATE KEY UPDATE country_coverage = VALUES(country_coverage), city = VALUES(city), expertise_notes = VALUES(expertise_notes), contact_email = VALUES(contact_email), contact_phone = VALUES(contact_phone), telegram_chat_id = VALUES(telegram_chat_id), preferred_channels = VALUES(preferred_channels), use_custom_margin = VALUES(use_custom_margin), margin_rate = VALUES(margin_rate)`,
              [row.name, row.country_coverage, row.city || null, row.expertise_notes || null, row.contact_email || null, row.contact_phone || null, row.telegram_chat_id || null, JSON.stringify(row.preferred_channels), row.use_custom_margin ? 1 : 0, row.margin_rate]
            );
            inserted++;
          } catch {
            skipped++;
          }
        }
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid import type. Use postal_codes, route_pricing, or vendors' } },
          { status: 400 }
        );
    }

    await logAuthEvent({
      event_type: 'data_imported',
      admin_id: auth.admin.id,
      details: { import_type: importType, inserted, skipped, filename: file.name },
    });

    return NextResponse.json({
      success: true,
      data: { inserted, skipped, type: importType },
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Import failed' } },
      { status: 500 }
    );
  }
}
