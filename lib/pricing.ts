import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

export interface PricingInput {
  originRegion: string;
  destinationRegion: string;
  weightKg: number;
  marginRate?: number;
}

export interface PricingResult {
  basePrice: number;
  markupPercent: number;
  marginRate: number;
  finalPrice: number;
  currency: string;
  found: boolean;
}

const OVERSIZE_THRESHOLD_KG = 22000; // 22 tons

export function isOversize(weightKg: number): boolean {
  return weightKg > OVERSIZE_THRESHOLD_KG;
}

export async function calculatePricing(input: PricingInput): Promise<PricingResult> {
  const [rows] = await pool.execute<
    Array<
      RowDataPacket & {
        base_price: number;
        markup_percent: number;
        currency: string;
      }
    >
  >(
    `SELECT base_price, markup_percent, currency
     FROM route_pricing
     WHERE LOWER(origin_region) = LOWER(?) AND LOWER(destination_region) = LOWER(?) AND is_active = TRUE
     LIMIT 1`,
    [input.originRegion, input.destinationRegion]
  );

  if (!rows || rows.length === 0) {
    return {
      basePrice: 0,
      markupPercent: 0,
      marginRate: input.marginRate ?? 0,
      finalPrice: 0,
      currency: 'TRY',
      found: false,
    };
  }

  const route = rows[0];
  const marginRate = input.marginRate ?? 0;
  const markupMultiplier = 1 + route.markup_percent / 100;
  const marginMultiplier = 1 + marginRate / 100;
  const finalPrice = route.base_price * markupMultiplier * marginMultiplier;

  return {
    basePrice: route.base_price,
    markupPercent: route.markup_percent,
    marginRate,
    finalPrice,
    currency: route.currency,
    found: true,
  };
}
