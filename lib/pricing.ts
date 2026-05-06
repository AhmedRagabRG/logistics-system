import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

export interface PricingInput {
  originRegion: string;
  destinationRegion: string;
  weightKg: number;
  marginRate?: number;
  transportMode?: 'road' | 'sea';
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
  const notFound: PricingResult = {
    basePrice: 0,
    markupPercent: 0,
    marginRate: input.marginRate ?? 0,
    finalPrice: 0,
    currency: 'TRY',
    found: false,
  };

  const transportMode = input.transportMode ?? 'road';

  // 1. Try exact match first (case-insensitive) with transport mode
  const [exactRows] = await pool.execute<
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
     WHERE LOWER(origin_region) = LOWER(?) AND LOWER(destination_region) = LOWER(?) AND transport_mode = ? AND is_active = TRUE
     LIMIT 1`,
    [input.originRegion, input.destinationRegion, transportMode]
  );

  let rows = exactRows;

  // 2. If exact match fails, try flexible match (bidirectional containment)
  //    This handles: "Berlin" matching "Berlin, Almanya" and vice versa
  if (!rows || rows.length === 0) {
    console.log(`[PRICING] Exact match failed for "${input.originRegion}" -> "${input.destinationRegion}". Trying flexible match...`);

    const [flexRows] = await pool.execute<
      Array<
        RowDataPacket & {
          base_price: number;
          markup_percent: number;
          currency: string;
          origin_region: string;
          destination_region: string;
        }
      >
    >(
      `SELECT base_price, markup_percent, currency, origin_region, destination_region
       FROM route_pricing
       WHERE (
         LOWER(origin_region) = LOWER(?)
         OR LOWER(origin_region) LIKE LOWER(CONCAT('%', ?, '%'))
         OR LOWER(?) LIKE LOWER(CONCAT('%', origin_region, '%'))
       )
       AND (
         LOWER(destination_region) = LOWER(?)
         OR LOWER(destination_region) LIKE LOWER(CONCAT('%', ?, '%'))
         OR LOWER(?) LIKE LOWER(CONCAT('%', destination_region, '%'))
       )
       AND transport_mode = ?
       AND is_active = TRUE
       LIMIT 1`,
      [
        input.originRegion, input.originRegion, input.originRegion,
        input.destinationRegion, input.destinationRegion, input.destinationRegion,
        transportMode,
      ]
    );
    rows = flexRows;

    if (rows && rows.length > 0) {
      const matched = rows[0];
      console.log(`[PRICING] Flexible match found: DB origin="${matched.origin_region}" dest="${matched.destination_region}" for input origin="${input.originRegion}" dest="${input.destinationRegion}"`);
    }
  }

  if (!rows || rows.length === 0) {
    console.log(`[PRICING] No pricing found for "${input.originRegion}" -> "${input.destinationRegion}"`);
    return notFound;
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
