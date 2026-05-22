import { z } from 'zod';

export const shipmentRequestSchema = z.object({
  origin_postal_code: z
    .string()
    .min(1, 'Origin postal code is required')
    .max(20, 'Origin postal code must be at most 20 characters'),
  destination_postal_code: z
    .string()
    .min(1, 'Destination postal code is required')
    .max(20, 'Destination postal code must be at most 20 characters'),
  weight_kg: z.number().positive('Weight must be greater than 0'),
  cargo_type: z.string().max(64).optional(),
  customer_name: z.string().max(128).optional(),
  customer_contact: z.string().max(128).optional(),
  language: z.enum(['ar', 'tr', 'en']).refine((val) => ['ar', 'tr', 'en'].includes(val), {
    message: 'Language must be ar, tr, or en',
  }),
  channel: z.enum(['whatsapp', 'telegram', 'email']).refine((val) => ['whatsapp', 'telegram', 'email'].includes(val), {
    message: 'Channel must be whatsapp, telegram, or email',
  }),
  handling_mode: z.enum(['auto', 'manual', 'external']).default('manual'),
});

export type ShipmentRequestInput = z.infer<typeof shipmentRequestSchema>;

export const quoteApproveSchema = z.object({
  revised_price: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
  response_text: z.string().max(2000).optional(),
});

export const quoteRejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  response_text: z.string().max(2000).optional(),
});

export const quoteUpdateSchema = z.object({
  base_price: z.number().min(0).optional(),
  markup_percent: z.number().min(0).max(1000).optional(),
  final_price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  sea_base_price: z.number().min(0).optional(),
  sea_markup_percent: z.number().min(0).max(1000).optional(),
  sea_final_price: z.number().min(0).optional(),
  sea_currency: z.string().length(3).optional(),
  is_dual_mode: z.boolean().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'ready_to_send', 'sent']).optional(),
  handling_mode: z.enum(['auto', 'manual', 'external']).optional(),
  rfq_id: z.number().int().positive().optional(),
  review_reason: z.string().max(500).optional(),
  origin_region: z.string().max(64).optional(),
  destination_region: z.string().max(64).optional(),
  origin_postal_code: z.string().max(20).optional().nullable(),
  destination_postal_code: z.string().max(20).optional().nullable(),
  weight_kg: z.number().min(0).optional().nullable(),
  cargo_type: z.string().max(64).optional().nullable(),
  response_text: z.string().max(2000).optional().nullable(),
});

export const vendorSchema = z.object({
  name: z.string().min(1).max(128),
  country_coverage: z.string().min(1).max(255),
  city: z.string().max(128).optional(),
  authorized_person_name: z.string().max(128).optional(),
  expertise_notes: z.string().max(2000).optional(),
  priority_ranking: z.coerce.number().int().min(1).max(10000).default(100),
  use_custom_margin: z.coerce.boolean().default(false),
  margin_rate: z.coerce.number().min(0).max(100).default(0),
  contact_email: z.string().email().max(255).optional(),
  contact_phone: z.string().max(32).optional(),
  telegram_chat_id: z.string().max(64).optional(),
  preferred_channels: z.array(z.enum(['email', 'whatsapp', 'telegram'])).default([]),
  is_active: z.coerce.boolean().default(true),
});

export const routePricingSchema = z.object({
  origin_region: z.string().min(1).max(64),
  destination_region: z.string().min(1).max(64),
  base_price: z.coerce.number().positive(),
  markup_percent: z.coerce.number().min(0).max(1000),
  currency: z.string().length(3).default('TRY'),
  is_sea_active: z.coerce.boolean().default(false),
  sea_base_price: z.coerce.number().min(0).default(0),
  sea_markup_percent: z.coerce.number().min(0).max(1000).default(0),
  sea_currency: z.string().length(3).default('TRY'),
  is_active: z.coerce.boolean().default(true),
});

export const systemSettingsSchema = z.object({
  master_logic_toggle: z.enum(['auto_send', 'low_confidence_only', 'manual_approval']),
  default_currency: z.string().length(3).default('TRY'),
  oversize_weight_threshold_tons: z.number().positive().default(22.00),
  waiting_period: z.string().regex(/^\d+[mhd]$/, 'Must be a number followed by m, h, or d (e.g. 30m, 2h, 1d)').default('30m'),
  global_markup_percent: z.number().min(0).max(1000).default(0),
  vendor_msg_email: z.string().max(5000).optional().nullable(),
  vendor_msg_telegram: z.string().max(5000).optional().nullable(),
  vendor_msg_whatsapp: z.string().max(5000).optional().nullable(),
  is_paused: z.coerce.boolean().default(false),
  rfq_send_mode: z.enum(['auto', 'manual']).default('auto'),
});

export const rfqCreateSchema = z.object({
  quote_id: z.number().int().positive(),
  rfq_reference: z.string().min(1).max(64),
  target_country: z.string().length(2),
  vendors: z.array(
    z.object({
      vendor_id: z.number().int().positive(),
      contact_channel: z.enum(['email', 'whatsapp', 'telegram']),
      contact_id: z.string().min(1).max(64),
    })
  ).min(1),
});

export const rfqVendorResponseSchema = z.object({
  vendor_id: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().length(3).optional().nullable(),
});

export const rfqUpdateSchema = z.object({
  vendor_responses: z.array(rfqVendorResponseSchema),
});

export const rfqGenerateQuoteSchema = z.object({
  selected_vendor_id: z.number().int().positive(),
  admin_margin_percent: z.number().min(0).max(1000).optional(),
});
