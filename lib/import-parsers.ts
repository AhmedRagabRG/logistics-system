import * as xlsx from 'xlsx';

// ─── Postal Codes ──────────────────────────────────────────────────────────

export interface PostalCodeRow {
  country_code: string;
  prefix: string;
  region: string;
}

export function parsePostalCodes(buffer: Buffer): PostalCodeRow[] {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames.find((s) => s.includes('Avrupa')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

  const rows: PostalCodeRow[] = [];

  for (const row of data) {
    const countryCode = (row['ISO'] || row['iso'] || '').trim().toUpperCase();
    const prefixRaw = (row['Posta Kodu İlk 2 / Prefix'] || row['prefix'] || '').trim();
    const region = (row['Posta Bölgesi'] || row['Lojistik Bölge'] || row['region'] || '').trim();

    if (!countryCode || !prefixRaw || !region) continue;

    // Expand ranges like "01-09", "10-19", "20-29"
    const rangeMatch = prefixRaw.match(/^(\d{2})-(\d{2})$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) {
        rows.push({ country_code: countryCode, prefix: String(i).padStart(2, '0'), region });
      }
    } else if (/^\d{2}$/.test(prefixRaw)) {
      rows.push({ country_code: countryCode, prefix: prefixRaw, region });
    } else {
      // Try comma-separated
      const parts = prefixRaw.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        const m = part.match(/^(\d{2})-(\d{2})$/);
        if (m) {
          const s = parseInt(m[1], 10);
          const e = parseInt(m[2], 10);
          for (let i = s; i <= e; i++) {
            rows.push({ country_code: countryCode, prefix: String(i).padStart(2, '0'), region });
          }
        } else if (/^\d{2}$/.test(part)) {
          rows.push({ country_code: countryCode, prefix: part, region });
        }
      }
    }
  }

  return rows;
}

// ─── Route Pricing ─────────────────────────────────────────────────────────

export interface RoutePricingRow {
  origin_region: string;
  destination_region: string;
  base_price: number;
  markup_percent: number;
  currency: string;
  transport_mode: 'road' | 'sea';
}

export function parseRoutePricing(buffer: Buffer): RoutePricingRow[] {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' });

  const rows: RoutePricingRow[] = [];

  // Skip first 2 header rows
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row) || row.length < 5) continue;

    const origin = String(row[1] || '').trim();
    const destination = String(row[2] || '').trim();
    const transportModeRaw = String(row[3] || '').trim().toLowerCase();
    const transport_mode: 'road' | 'sea' = transportModeRaw === 'sea' || transportModeRaw === 'deniz' ? 'sea' : 'road';
    const priceExport = parseFloat(String(row[4] || '').replace(/,/g, ''));
    const currency = String(row[5] || 'EUR').trim().toUpperCase();
    const priceImport = parseFloat(String(row[6] || '').replace(/,/g, ''));

    if (!origin || !destination || (isNaN(priceExport) && isNaN(priceImport))) continue;

    // Add export route
    if (!isNaN(priceExport) && priceExport > 0) {
      rows.push({
        origin_region: origin,
        destination_region: destination,
        base_price: priceExport,
        markup_percent: 0,
        currency,
        transport_mode,
      });
    }

    // Add import route (reverse direction)
    if (!isNaN(priceImport) && priceImport > 0) {
      rows.push({
        origin_region: destination,
        destination_region: origin,
        base_price: priceImport,
        markup_percent: 0,
        currency,
        transport_mode,
      });
    }
  }

  return rows;
}

// ─── Vendors ───────────────────────────────────────────────────────────────

export interface VendorRow {
  name: string;
  country_coverage: string;
  expertise_notes: string;
  contact_email: string;
  contact_phone: string;
  telegram_chat_id: string;
  use_custom_margin: boolean;
  margin_rate: number;
}

export function parseVendors(buffer: Buffer): VendorRow[] {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const rows: VendorRow[] = [];

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'ANASAYFA') continue;

    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    for (const row of data) {
      const name = String(row['FİRMA'] || row['FIRMA'] || '').trim();
      const origin = String(row['MENŞEİ'] || row['MENSEI'] || '').trim();
      const email = String(row['MAİL İHRACAT'] || row['MAIL İHRACAT'] || row['MAİL İTHALAT'] || row['email'] || '').trim();
      const phone = String(row['CEP'] || row['TEL'] || row['phone'] || '').trim();
      const telegramChatId = String(row['TELEGRAM'] || row['TELEGRAM CHAT ID'] || row['telegram_chat_id'] || '').trim();
      const notes = String(row['NOT'] || row['not'] || '').trim();
      const useCustomMarginRaw = String(row['USE CUSTOM MARGIN'] || row['use_custom_margin'] || '').trim().toLowerCase();
      const marginRateRaw = String(row['MARGIN RATE (%)'] || row['margin_rate'] || '').trim();

      if (!name) continue;

      const countryCoverage = origin ? `${sheetName} (${origin})` : sheetName;
      const useCustomMargin = useCustomMarginRaw === 'yes' || useCustomMarginRaw === 'true' || useCustomMarginRaw === '1' || useCustomMarginRaw === 'evet';
      const marginRate = parseFloat(marginRateRaw) || 0;

      rows.push({
        name,
        country_coverage: countryCoverage,
        expertise_notes: notes,
        contact_email: email,
        contact_phone: phone,
        telegram_chat_id: telegramChatId,
        use_custom_margin: useCustomMargin,
        margin_rate: marginRate,
      });
    }
  }

  return rows;
}

// ─── CSV fallback ──────────────────────────────────────────────────────────

export function parseCSV(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}
