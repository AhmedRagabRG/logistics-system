import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Normalize a country string (full name or 2-letter code) to ISO 3166-1 alpha-2.
 * Returns the 2-letter code if resolvable, null otherwise.
 */
function normalizeCountryCode(country: string | null | undefined): string | null {
  if (!country) return null;
  const c = country.trim();
  if (/^[A-Z]{2}$/i.test(c)) return c.toUpperCase();

  const map: Record<string, string> = {
    egypt: 'EG',
    turkey: 'TR',
    turkiye: 'TR',
    germany: 'DE',
    deutschland: 'DE',
    france: 'FR',
    poland: 'PL',
    italy: 'IT',
    spain: 'ES',
    netherlands: 'NL',
    belgium: 'BE',
    austria: 'AT',
    czech: 'CZ',
    'czech republic': 'CZ',
    hungary: 'HU',
    romania: 'RO',
    bulgaria: 'BG',
    greece: 'GR',
    croatia: 'HR',
    slovenia: 'SI',
    slovakia: 'SK',
    serbia: 'RS',
    bosnia: 'BA',
    albania: 'AL',
    ukraine: 'UA',
    moldova: 'MD',
    lithuania: 'LT',
    latvia: 'LV',
    estonia: 'EE',
    finland: 'FI',
    sweden: 'SE',
    norway: 'NO',
    denmark: 'DK',
    switzerland: 'CH',
    portugal: 'PT',
    russia: 'RU',
    'united kingdom': 'GB',
    uk: 'GB',
  };
  const key = c.toLowerCase().replace(/[^a-z\s]/g, '');
  return map[key] ?? null;
}

/**
 * Resolve region from postal code using progressive prefix matching.
 *
 * Tries the longest possible prefix first, then progressively shorter.
 * If a countryHint is provided, ONLY matches postal codes in that country.
 * This prevents an Egyptian postal code from matching Germany.
 *
 * The postal_codes table has a prefix_length column to guide matching.
 */
export async function resolveRegionFromPostalCode(postalCode: string, countryHint?: string | null): Promise<string | null> {
  if (!postalCode || postalCode.length === 0) return null;

  // Clean postal code: remove spaces, dashes, letters for numeric extraction
  const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();

  // Extract numeric prefix (first 1-5 digits)
  const numericMatch = cleaned.match(/^(\d{1,5})/);
  if (!numericMatch) return null;

  const numericPrefix = numericMatch[1];
  const countryCode = normalizeCountryCode(countryHint);

  // Try progressively shorter prefixes (longest first)
  for (let len = Math.min(5, numericPrefix.length); len >= 1; len--) {
    const prefix = numericPrefix.substring(0, len);

    if (countryCode) {
      const [rows] = await pool.execute<
        Array<RowDataPacket & { region: string; prefix_length: number }>
      >(
        'SELECT region, prefix_length FROM postal_codes WHERE prefix = ? AND prefix_length = ? AND country_code = ? LIMIT 1',
        [prefix, len, countryCode]
      );

      if (rows && rows.length > 0) {
        return rows[0].region;
      }
    } else {
      const [rows] = await pool.execute<
        Array<RowDataPacket & { region: string; prefix_length: number }>
      >(
        'SELECT region, prefix_length FROM postal_codes WHERE prefix = ? AND prefix_length = ? LIMIT 1',
        [prefix, len]
      );

      if (rows && rows.length > 0) {
        return rows[0].region;
      }
    }
  }

  return null;
}

export async function resolveCountryFromPostalCode(postalCode: string): Promise<string | null> {
  if (!postalCode || postalCode.length === 0) return null;

  const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();
  const numericMatch = cleaned.match(/^(\d{1,5})/);
  if (!numericMatch) return null;

  const numericPrefix = numericMatch[1];

  // Try progressively shorter prefixes
  for (let len = Math.min(5, numericPrefix.length); len >= 1; len--) {
    const prefix = numericPrefix.substring(0, len);

    const [rows] = await pool.execute<
      Array<RowDataPacket & { country_code: string; prefix_length: number }>
    >(
      'SELECT country_code, prefix_length FROM postal_codes WHERE prefix = ? AND prefix_length = ? LIMIT 1',
      [prefix, len]
    );

    if (rows && rows.length > 0) {
      return rows[0].country_code;
    }
  }

  return null;
}
