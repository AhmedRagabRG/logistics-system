import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';

export interface VendorMessageVars {
  vendor_name: string;
  rfq_reference: string;
  origin_region: string;
  destination_region: string;
  weight_kg: number;
  cargo_type: string | null;
  target_country: string;
}

function substituteTemplate(template: string, vars: VendorMessageVars): string {
  return template
    .replace(/\{\{vendor_name\}\}/g, vars.vendor_name)
    .replace(/\{\{rfq_reference\}\}/g, vars.rfq_reference)
    .replace(/\{\{origin_region\}\}/g, vars.origin_region)
    .replace(/\{\{destination_region\}\}/g, vars.destination_region)
    .replace(/\{\{weight_kg\}\}/g, vars.weight_kg.toLocaleString())
    .replace(/\{\{cargo_type\}\}/g, vars.cargo_type ?? 'General Cargo')
    .replace(/\{\{target_country\}\}/g, vars.target_country);
}

export async function getVendorMessageTemplate(
  channel: 'email' | 'telegram' | 'whatsapp'
): Promise<string | null> {
  const column =
    channel === 'email'
      ? 'vendor_msg_email'
      : channel === 'telegram'
      ? 'vendor_msg_telegram'
      : 'vendor_msg_whatsapp';

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${column} as template FROM system_settings ORDER BY id DESC LIMIT 1`
  );
  if (!rows || rows.length === 0) return null;
  const template = rows[0].template;
  return typeof template === 'string' && template.trim().length > 0 ? template : null;
}

export async function renderVendorMessage(
  channel: 'email' | 'telegram' | 'whatsapp',
  vars: VendorMessageVars
): Promise<{ subject: string; message: string } | null> {
  const template = await getVendorMessageTemplate(channel);
  if (!template) return null;

  const message = substituteTemplate(template, vars);
  const subject = channel === 'email'
    ? `Quote Request ${vars.rfq_reference}`
    : '';

  return { subject, message };
}
