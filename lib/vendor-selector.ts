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

  const aliases: Record<string, string[]> = {
    turkey: ['türkiye', 'turkey', 'tr'],
    türkiye: ['türkiye', 'turkey', 'tr'],
    russia: ['rusya', 'russia', 'ru', 'russian federation'],
    rusya: ['rusya', 'russia', 'ru', 'russian federation'],
    germany: ['almanya', 'germany', 'de', 'deutschland'],
    almanya: ['almanya', 'germany', 'de', 'deutschland'],
    egypt: ['misir', 'egypt', 'eg'],
    misir: ['misir', 'egypt', 'eg'],
    ukraine: ['ukrayna', 'ukraine', 'ua'],
    ukrayna: ['ukrayna', 'ukraine', 'ua'],
    poland: ['polonya', 'poland', 'pl'],
    polonya: ['polonya', 'poland', 'pl'],
    france: ['fransa', 'france', 'fr'],
    fransa: ['fransa', 'france', 'fr'],
    italy: ['italya', 'italy', 'it'],
    italya: ['italya', 'italy', 'it'],
    spain: ['ispanya', 'spain', 'es'],
    ispanya: ['ispanya', 'spain', 'es'],
    netherlands: ['hollanda', 'netherlands', 'nl'],
    hollanda: ['hollanda', 'netherlands', 'nl'],
    belgium: ['belçika', 'belgium', 'be'],
    'belçika': ['belçika', 'belgium', 'be'],
    austria: ['avusturya', 'austria', 'at'],
    avusturya: ['avusturya', 'austria', 'at'],
    romania: ['romanya', 'romania', 'ro'],
    romanya: ['romanya', 'romania', 'ro'],
    bulgaria: ['bulgaristan', 'bulgaria', 'bg'],
    bulgaristan: ['bulgaristan', 'bulgaria', 'bg'],
    greece: ['yunanistan', 'greece', 'gr'],
    yunanistan: ['yunanistan', 'greece', 'gr'],
    serbia: ['sırbistan', 'serbia', 'rs'],
    sırbistan: ['sırbistan', 'serbia', 'rs'],
    hungary: ['macaristan', 'hungary', 'hu'],
    macaristan: ['macaristan', 'hungary', 'hu'],
    czech: ['çekya', 'czech', 'czech republic', 'cz'],
    çekya: ['çekya', 'czech', 'czech republic', 'cz'],
    slovakia: ['slovakya', 'slovakia', 'sk'],
    slovakya: ['slovakya', 'slovakia', 'sk'],
    croatia: ['hirvatistan', 'croatia', 'hr'],
    hirvatistan: ['hirvatistan', 'croatia', 'hr'],
    slovenia: ['slovenya', 'slovenia', 'si'],
    slovenya: ['slovenya', 'slovenia', 'si'],
    bosnia: ['bosna', 'bosnia', 'ba'],
    bosna: ['bosna', 'bosnia', 'ba'],
    albania: ['arnavutluk', 'albania', 'al'],
    arnavutluk: ['arnavutluk', 'albania', 'al'],
    moldova: ['moldova', 'md'],
    lithuania: ['litvanya', 'lithuania', 'lt'],
    litvanya: ['litvanya', 'lithuania', 'lt'],
    latvia: ['letonya', 'latvia', 'lv'],
    letonya: ['letonya', 'latvia', 'lv'],
    estonia: ['estonya', 'estonia', 'ee'],
    estonya: ['estonya', 'estonia', 'ee'],
    finland: ['finlandiya', 'finland', 'fi'],
    finlandiya: ['finlandiya', 'finland', 'fi'],
    sweden: ['isveç', 'sweden', 'se'],
    isveç: ['isveç', 'sweden', 'se'],
    norway: ['norveç', 'norway', 'no'],
    norveç: ['norveç', 'norway', 'no'],
    denmark: ['danimarka', 'denmark', 'dk'],
    danimarka: ['danimarka', 'denmark', 'dk'],
    switzerland: ['isviçre', 'switzerland', 'ch'],
    isviçre: ['isviçre', 'switzerland', 'ch'],
    portugal: ['portekiz', 'portugal', 'pt'],
    portekiz: ['portekiz', 'portugal', 'pt'],
    'united kingdom': ['birleşik krallık', 'united kingdom', 'uk', 'gb', 'england'],
    'birleşik krallık': ['birleşik krallık', 'united kingdom', 'uk', 'gb', 'england'],
    england: ['birleşik krallık', 'united kingdom', 'uk', 'gb', 'england'],
  };

  if (aliases[normalized]) {
    aliases[normalized].forEach((a) => terms.add(a));
  }

  return Array.from(terms);
}

/**
 * Select ALL active vendors that cover the given destination country.
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
    `SELECT id, name, country_coverage, expertise_notes, priority_ranking, margin_rate,
            contact_email, contact_phone, preferred_channels, is_active, created_at, updated_at
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
