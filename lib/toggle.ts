import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

type ToggleState = 'auto_send' | 'low_confidence_only' | 'manual_approval';
type RfqSendMode = 'auto' | 'manual';

let cachedToggle: ToggleState | null = null;
let cachedPaused: boolean | null = null;
let cachedRfqMode: RfqSendMode | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export async function getMasterLogicToggle(): Promise<ToggleState> {
  const now = Date.now();

  if (cachedToggle && now - cachedAt < CACHE_TTL_MS) {
    return cachedToggle;
  }

  const [rows] = await pool.execute<
    Array<RowDataPacket & { master_logic_toggle: ToggleState }>
  >(
    'SELECT master_logic_toggle FROM system_settings ORDER BY id DESC LIMIT 1'
  );

  const toggle = rows && rows.length > 0 ? rows[0].master_logic_toggle : 'manual_approval';

  cachedToggle = toggle;
  cachedAt = now;

  return toggle;
}

export async function getSystemPausedState(): Promise<boolean> {
  const now = Date.now();

  if (cachedPaused !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedPaused;
  }

  const [rows] = await pool.execute<
    Array<RowDataPacket & { is_paused: number | boolean }>
  >(
    'SELECT is_paused FROM system_settings ORDER BY id DESC LIMIT 1'
  );

  const paused = rows && rows.length > 0 ? Boolean(rows[0].is_paused) : false;

  cachedPaused = paused;
  cachedAt = now;

  return paused;
}

export async function getRfqSendMode(): Promise<RfqSendMode> {
  const now = Date.now();

  if (cachedRfqMode && now - cachedAt < CACHE_TTL_MS) {
    return cachedRfqMode;
  }

  const [rows] = await pool.execute<
    Array<RowDataPacket & { rfq_send_mode: RfqSendMode }>
  >(
    'SELECT rfq_send_mode FROM system_settings ORDER BY id DESC LIMIT 1'
  );

  const mode = rows && rows.length > 0 ? rows[0].rfq_send_mode : 'auto';

  cachedRfqMode = mode;
  cachedAt = now;

  return mode;
}

export function invalidateToggleCache(): void {
  cachedToggle = null;
  cachedPaused = null;
  cachedRfqMode = null;
  cachedAt = 0;
}
