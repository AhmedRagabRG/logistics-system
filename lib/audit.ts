import pool from './db';

export interface AuditEvent {
  event_type: string;
  admin_id?: number | null;
  session_token?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown> | null;
}

export async function logAuthEvent(event: AuditEvent): Promise<void> {
  await pool.execute(
    `INSERT INTO system_logs (event_type, admin_id, session_token, ip_address, user_agent, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.event_type,
      event.admin_id ?? null,
      event.session_token ?? null,
      event.ip_address ?? null,
      event.user_agent ?? null,
      event.details ? JSON.stringify(event.details) : null,
    ]
  );
}

export interface PricingEvent {
  event_type: 'quote_created' | 'quote_approved' | 'quote_rejected' | 'quote_ready' | 'rfq_initiated' | 'quote_updated' | 'rfq_quote_generated' | 'customer_response_sent' | 'customer_response_failed' | 'customer_approval_sent' | 'customer_approval_failed' | 'customer_rejection_sent' | 'customer_rejection_failed' | 'customer_rfq_ready_sent' | 'customer_rfq_ready_failed' | 'rfq_skipped' | 'rfq_vendors_skipped' | 'rfq_country_changed' | 'rfq_vendor_removed';
  quote_id: number;
  rfq_id?: number | null;
  admin_id?: number | null;
  details?: Record<string, unknown> | null;
}

export async function logPricingEvent(event: PricingEvent): Promise<void> {
  await pool.execute(
    `INSERT INTO system_logs (event_type, admin_id, quote_id, rfq_id, session_token, ip_address, user_agent, details)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)`,
    [
      event.event_type,
      event.admin_id ?? null,
      event.quote_id ?? null,
      event.rfq_id ?? null,
      event.details ? JSON.stringify(event.details) : null,
    ]
  );
}

export interface VendorEvent {
  event_type: 'vendor_selected' | 'vendor_rfq_sent' | 'vendor_rfq_send_failed' | 'vendor_response_received';
  quote_id: number;
  rfq_id?: number | null;
  vendor_id?: number | null;
  admin_id?: number | null;
  details?: Record<string, unknown> | null;
}

export async function logVendorEvent(event: VendorEvent): Promise<void> {
  await pool.execute(
    `INSERT INTO system_logs (event_type, admin_id, quote_id, rfq_id, session_token, ip_address, user_agent, details)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)`,
    [
      event.event_type,
      event.admin_id ?? null,
      event.quote_id ?? null,
      event.rfq_id ?? null,
      event.details ? JSON.stringify(event.details) : null,
    ]
  );
}
