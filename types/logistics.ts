export interface ShipmentRequest {
  id: number;
  customer_name: string | null;
  customer_contact: string | null;
  origin_postal_code: string | null;
  destination_postal_code: string | null;
  weight_kg: number | null;
  cargo_type: string | null;
  language: 'ar' | 'tr' | 'en';
  channel: 'whatsapp' | 'telegram' | 'email';
  raw_payload: Record<string, unknown>;
  raw_message: string | null;
  created_at: Date;
}

export interface Quote {
  id: number;
  shipment_request_id: number;
  origin_region: string;
  destination_region: string;
  origin_postal_code: string | null;
  destination_postal_code: string | null;
  weight_kg: number | null;
  cargo_type: string | null;
  base_price: number;
  markup_percent: number;
  final_price: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'ready_to_send';
  handling_mode: 'auto' | 'manual' | 'external';
  rfq_id: number | null;
  toggle_state_at_creation: string;
  is_oversize: boolean;
  review_reason: string | null;
  response_text: string | null;
  approved_by: number | null;
  approved_at: Date | null;
  created_at: Date;
}

export interface RoutePricing {
  id: number;
  origin_region: string;
  destination_region: string;
  base_price: number;
  markup_percent: number;
  currency: string;
  is_active: boolean;
  last_updated: Date;
  created_at: Date;
}

export interface Vendor {
  id: number;
  name: string;
  country_coverage: string;
  expertise_notes: string | null;
  authorized_person_name: string | null;
  priority_ranking: number;
  use_custom_margin: boolean;
  margin_rate: number;
  contact_email: string | null;
  contact_phone: string | null;
  telegram_chat_id: string | null;
  preferred_channels: string[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SystemSettings {
  id: number;
  master_logic_toggle: 'auto_send' | 'low_confidence_only' | 'manual_approval';
  default_currency: string;
  exchange_rate_reference_date: Date | null;
  oversize_weight_threshold_tons: number;
  waiting_period: string;
  global_markup_percent: number;
  updated_at: Date;
}

export interface RFQRecord {
  id: number;
  quote_id: number;
  rfq_reference: string;
  target_country: string;
  selected_vendors: number[];
  vendor_responses: Array<{ vendor_id: number; price: number; currency: string }> | null;
  generated_quote_price: number | null;
  status: 'open' | 'responded' | 'closed';
  created_at: Date;
  updated_at: Date;
}

export interface RFQVendorAssignment {
  id: number;
  rfq_id: number;
  vendor_id: number;
  vendor_name?: string;
  contact_channel: 'email' | 'whatsapp' | 'telegram';
  contact_id: string;
  response_price: number | null;
  response_currency: string | null;
  responded_at: Date | null;
  status: 'pending' | 'responded';
  created_at: Date;
}

export interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: Date;
  created_at: Date;
}

export interface PostalCode {
  id: number;
  country_code: string;
  prefix: string;
  region: string;
  prefix_length: number;
}

export interface QuoteResult {
  quote_id?: number;
  status: 'ready_to_send' | 'pending' | 'data_request';
  origin_region?: string;
  destination_region?: string;
  base_price?: number;
  markup_percent?: number;
  final_price?: number;
  currency?: string;
  is_oversize?: boolean;
  review_reason?: string;
  missing_fields?: string[];
  rfq?: {
    target_country: string;
    selected_vendors: Array<{ id: number; name: string }>;
  };
  message: string;
}

export interface AnalyticsSummary {
  total_requests: number;
  total_quotes: number;
  pending_quotes: number;
  approved_quotes: number;
  rejected_quotes: number;
  avg_response_time_minutes: number | null;
  approval_rate_percent: number;
}

export interface ChannelDistribution {
  channel: string;
  count: number;
}

export interface LanguageDistribution {
  language: string;
  count: number;
}

export interface UnmatchedVendorReply {
  id: number;
  contact_id: string;
  contact_channel: string | null;
  reply_text: string;
  parsed_price: number | null;
  parsed_currency: string | null;
  status: 'unmatched' | 'resolved' | 'ignored';
  matched_rfq_id: number | null;
  resolution_notes: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

export interface DailyVolume {
  date: string;
  requests: number;
  quotes: number;
}
