import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';
import type { Vendor } from '@/types/logistics';

/**
 * Normalize country names to search for multiple variants.
 * e.g. "Türkiye" → ["Türkiye", "Turkey", "TR"]
 * e.g. "Rusya" → ["Rusya", "Russia", "RU", "Russian Federation"]
 */
function getCountrySearchTerms(country: string): string[] {
  const normalized = country.trim().toLowerCase();
  const terms = new Set<string>();
  terms.add(normalized);

  const aliasGroups: string[][] = [
    ['türkiye', 'turkey', 'tr'],
    ['rusya', 'russia', 'ru', 'russian federation'],
    ['almanya', 'germany', 'de', 'deutschland'],
    ['misir', 'egypt', 'eg'],
    ['ukrayna', 'ukraine', 'ua'],
    ['polonya', 'poland', 'pl'],
    ['fransa', 'france', 'fr'],
    ['italya', 'italy', 'it'],
    ['ispanya', 'spain', 'es'],
    ['hollanda', 'netherlands', 'nl'],
    ['belçika', 'belgium', 'be'],
    ['avusturya', 'austria', 'at'],
    ['romanya', 'romania', 'ro'],
    ['bulgaristan', 'bulgaria', 'bg'],
    ['yunanistan', 'greece', 'gr'],
    ['sırbistan', 'serbia', 'rs'],
    ['macaristan', 'hungary', 'hu'],
    ['çekya', 'czech', 'czech republic', 'cz'],
    ['slovakya', 'slovakia', 'sk'],
    ['hirvatistan', 'croatia', 'hr'],
    ['slovenya', 'slovenia', 'si'],
    ['bosna', 'bosnia', 'ba'],
    ['arnavutluk', 'albania', 'al'],
    ['moldova', 'md'],
    ['litvanya', 'lithuania', 'lt'],
    ['letonya', 'latvia', 'lv'],
    ['estonya', 'estonia', 'ee'],
    ['finlandiya', 'finland', 'fi'],
    ['isveç', 'sweden', 'se'],
    ['norveç', 'norway', 'no'],
    ['danimarka', 'denmark', 'dk'],
    ['isviçre', 'switzerland', 'ch'],
    ['portekiz', 'portugal', 'pt'],
    ['birleşik krallık', 'united kingdom', 'uk', 'gb', 'england'],
  ];

  // Build bidirectional lookup: every term maps to its entire group
  for (const group of aliasGroups) {
    if (group.includes(normalized)) {
      group.forEach((term) => terms.add(term));
    }
  }

  return Array.from(terms);
}

/**
 * Select ALL active vendors that serve the given destination country.
 * Broadcasts RFQ to every matching vendor (no limit).
 * Uses country name normalization to handle Turkish/English/ISO variants.
 */
export async function selectVendorsForCountry(
  countryCode: string
): Promise<Vendor[]> {
  const searchTerms = getCountrySearchTerms(countryCode);

  // Build OR conditions for all search terms
  const conditions: string[] = [];
  const params: string[] = [];

  for (const term of searchTerms) {
    conditions.push('country_coverage LIKE ? OR expertise_notes LIKE ?');
    params.push(`%${term}%`, `%${term}%`);
  }

  const whereClause = conditions.join(' OR ');

  const [rows] = await pool.query<
    Array<RowDataPacket & Vendor>
  >(
    `SELECT id, name, country_coverage, city, authorized_person_name, expertise_notes, priority_ranking, use_custom_margin, margin_rate,
            contact_email, contact_phone, telegram_chat_id, preferred_channels, is_active, created_at, updated_at
     FROM vendors
     WHERE is_active = TRUE
       AND (${whereClause})
     ORDER BY priority_ranking ASC, id ASC`,
    params
  );

  return (rows || []).map((row) => ({
    ...row,
    preferred_channels:
      typeof row.preferred_channels === 'string'
        ? JSON.parse(row.preferred_channels)
        : row.preferred_channels ?? [],
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}
