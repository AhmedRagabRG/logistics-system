import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

const BASE_CURRENCY = 'TRY';

export async function normalizeToBaseCurrency(
  amount: number,
  fromCurrency: string
): Promise<number> {
  if (fromCurrency === BASE_CURRENCY) {
    return amount;
  }

  const [rows] = await pool.execute<
    Array<RowDataPacket & { rate: number }>
  >(
    `SELECT rate FROM exchange_rates
     WHERE from_currency = ? AND to_currency = ?
     ORDER BY effective_date DESC
     LIMIT 1`,
    [fromCurrency, BASE_CURRENCY]
  );

  if (!rows || rows.length === 0) {
    throw new Error(`No exchange rate found for ${fromCurrency} to ${BASE_CURRENCY}`);
  }

  return amount * rows[0].rate;
}

export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  const [rows] = await pool.execute<
    Array<RowDataPacket & { rate: number }>
  >(
    `SELECT rate FROM exchange_rates
     WHERE from_currency = ? AND to_currency = ?
     ORDER BY effective_date DESC
     LIMIT 1`,
    [fromCurrency, toCurrency]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  return rows[0].rate;
}
