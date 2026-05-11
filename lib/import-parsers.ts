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
  is_sea_active: boolean;
  sea_base_price: number;
  sea_markup_percent: number;
  sea_currency: string;
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
    const isSeaActiveRaw = String(row[3] || '').trim().toLowerCase();
    const is_sea_active = isSeaActiveRaw === 'yes' || isSeaActiveRaw === 'true' || isSeaActiveRaw === '1' || isSeaActiveRaw === 'evet';
    const roadPrice = parseFloat(String(row[4] || '').replace(/,/g, ''));
    const roadCurrency = String(row[5] || 'EUR').trim().toUpperCase();
    const seaPrice = parseFloat(String(row[6] || '').replace(/,/g, ''));
    const seaCurrency = String(row[7] || roadCurrency).trim().toUpperCase();
    const reverseRoadPrice = parseFloat(String(row[8] || '').replace(/,/g, ''));
    const reverseSeaPrice = parseFloat(String(row[9] || '').replace(/,/g, ''));

    if (!origin || !destination || (isNaN(roadPrice) && isNaN(reverseRoadPrice))) continue;

    // Add forward route (origin -> destination)
    if (!isNaN(roadPrice) && roadPrice > 0) {
      rows.push({
        origin_region: origin,
        destination_region: destination,
        base_price: roadPrice,
        markup_percent: 0,
        currency: roadCurrency,
        is_sea_active,
        sea_base_price: !isNaN(seaPrice) && seaPrice > 0 ? seaPrice : 0,
        sea_markup_percent: 0,
        sea_currency: seaCurrency,
      });
    }

    // Add reverse route (destination -> origin)
    if (!isNaN(reverseRoadPrice) && reverseRoadPrice > 0) {
      rows.push({
        origin_region: destination,
        destination_region: origin,
        base_price: reverseRoadPrice,
        markup_percent: 0,
        currency: roadCurrency,
        is_sea_active,
        sea_base_price: !isNaN(reverseSeaPrice) && reverseSeaPrice > 0 ? reverseSeaPrice : 0,
        sea_markup_percent: 0,
        sea_currency: seaCurrency,
      });
    }
  }

  return rows;
}

// ─── Vendors ───────────────────────────────────────────────────────────────

function getCellValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
    // Try exact match first
    if (row[key] !== undefined && row[key] !== '') {
      return String(row[key]).trim();
    }
    // Try case-insensitive match
    for (const [k, v] of Object.entries(row)) {
      if (
        v !== undefined &&
        v !== '' &&
        k.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedKey
      ) {
        return String(v).trim();
      }
    }
  }
  return '';
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toLocaleUpperCase('tr') + word.slice(1))
    .join(' ');
}

export interface VendorRow {
  name: string;
  country_coverage: string;
  city: string;
  expertise_notes: string;
  contact_email: string;
  contact_phone: string;
  telegram_chat_id: string;
  preferred_channels: string[];
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
      const name = getCellValue(row, ['FİRMA', 'FIRMA', 'firma', 'Firma', 'FIRMA ADI', 'firma adi', 'COMPANY', 'company', 'Company Name', 'company name']);
      const origin = getCellValue(row, ['MENŞEİ', 'MENSEI', 'mensei', 'Mensei', 'ORIGIN', 'origin', 'Origin City', 'origin city', 'CITY', 'city', 'ŞEHİR', 'sehir']);
      const email = getCellValue(row, [
        'MAİL İHRACAT',
        'MAIL İHRACAT',
        'MAİL İTHALAT',
        'MAIL İTHALAT',
        'email',
        'EMAIL',
        'E-mail',
        'e-mail',
        'E-MAIL',
        'MAİL',
        'MAIL',
        'mail',
        'E POSTA',
        'E-POSTA',
        'e-posta',
      ]);
      const phone = getCellValue(row, [
        'CEP',
        'TEL',
        'cep',
        'tel',
        'phone',
        'PHONE',
        'TELEFON',
        'telefon',
        'Telefon',
        'MOBILE',
        'mobile',
        'GSM',
        'gsm',
        'TEL NO',
        'tel no',
      ]);
      const telegramChatId = getCellValue(row, [
        'TELEGRAM',
        'TELEGRAM CHAT ID',
        'telegram_chat_id',
        'telegram',
        'Telegram',
        'TELEGRAM ID',
        'telegram id',
        'TG',
        'tg',
      ]);
      const notes = getCellValue(row, ['NOT', 'not', 'NOTLAR', 'notlar', 'Notes', 'notes', 'NOTES', 'AÇIKLAMA', 'aciklama', 'DESCRIPTION', 'description']);
      const useCustomMarginRaw = getCellValue(row, ['USE CUSTOM MARGIN', 'use_custom_margin', 'CUSTOM MARGIN', 'custom_margin', 'ÖZEL KAR', 'ozel kar']).toLowerCase();
      const marginRateRaw = getCellValue(row, ['MARGIN RATE (%)', 'margin_rate', 'MARGIN RATE', 'margin rate', 'KAR ORANI', 'kar orani', 'KAR %', 'kar %']);
      const preferredChannelsRaw = getCellValue(row, [
        'PREFERRED CHANNELS',
        'preferred_channels',
        'TERCİH EDİLEN KANALLAR',
        'tercih edilen kanallar',
        'TERCIH EDILEN KANALLAR',
        'KANALLAR',
        'kanallar',
        'CHANNELS',
        'channels',
      ]);

      if (!name) continue;

      const countryCoverage = toTitleCase(sheetName);
      const useCustomMargin = useCustomMarginRaw === 'yes' || useCustomMarginRaw === 'true' || useCustomMarginRaw === '1' || useCustomMarginRaw === 'evet';
      const marginRate = parseFloat(marginRateRaw) || 0;

      // Parse preferred channels — default to email + whatsapp if not specified
      let preferredChannels: string[] = ['email', 'whatsapp'];
      if (preferredChannelsRaw) {
        const parsed = preferredChannelsRaw
          .split(/[,;/|]+/)
          .map((c) => c.trim().toLowerCase())
          .filter((c) => ['email', 'whatsapp', 'telegram'].includes(c));
        if (parsed.length > 0) {
          preferredChannels = parsed;
        }
      }

      rows.push({
        name,
        country_coverage: countryCoverage,
        city: origin,
        expertise_notes: notes,
        contact_email: email,
        contact_phone: phone,
        telegram_chat_id: telegramChatId,
        preferred_channels: preferredChannels,
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
