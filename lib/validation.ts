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
  status: z.enum(['pending', 'approved', 'rejected', 'ready_to_send']).optional(),
  handling_mode: z.enum(['auto', 'manual', 'external']).optional(),
  rfq_id: z.number().int().positive().optional(),
  review_reason: z.string().max(500).optional(),
});

export const vendorSchema = z.object({
  name: z.string().min(1).max(128),
  country_coverage: z.string().min(1).max(255),
  city: z.string().max(128).optional(),
  expertise_notes: z.string().max(2000).optional(),
  priority_ranking: z.coerce.number().int().min(1).max(10000).default(100),
  use_custom_margin: z.boolean().default(false),
  margin_rate: z.coerce.number().min(0).max(100).default(0),
  contact_email: z.string().email().max(255).optional(),
  contact_phone: z.string().max(32).optional(),
  preferred_channels: z.array(z.enum(['email', 'whatsapp'])).default([]),
  is_active: z.boolean().default(true),
});

export const routePricingSchema = z.object({
  origin_region: z.string().min(1).max(64),
  destination_region: z.string().min(1).max(64),
  base_price: z.number().positive(),
  markup_percent: z.number().min(0).max(1000),
  currency: z.string().length(3).default('TRY'),
  is_active: z.boolean().default(true),
});

export const systemSettingsSchema = z.object({
  master_logic_toggle: z.enum(['auto_send', 'low_confidence_only', 'manual_approval']),
  default_currency: z.string().length(3).default('TRY'),
  oversize_weight_threshold_tons: z.number().positive().default(22.00),
  waiting_period: z.string().regex(/^\d+[mhd]$/, 'Must be a number followed by m, h, or d (e.g. 30m, 2h, 1d)').default('30m'),
  global_markup_percent: z.number().min(0).max(1000).default(0),
});

export const exchangeRateSchema = z.object({
  from_currency: z.string().length(3),
  to_currency: z.string().length(3),
  rate: z.number().positive(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const rfqCreateSchema = z.object({
  quote_id: z.number().int().positive(),
  rfq_reference: z.string().min(1).max(64),
  target_country: z.string().length(2),
  vendors: z.array(
    z.object({
      vendor_id: z.number().int().positive(),
      contact_channel: z.enum(['email', 'whatsapp']),
      contact_id: z.string().min(1).max(64),
    })
  ).min(1),
});

export const rfqVendorResponseSchema = z.object({
  vendor_id: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().length(3).default('TRY'),
});

export const rfqUpdateSchema = z.object({
  vendor_responses: z.array(rfqVendorResponseSchema),
});

export const rfqGenerateQuoteSchema = z.object({
  selected_vendor_id: z.number().int().positive(),
  admin_margin_percent: z.number().min(0).max(1000).optional(),
});
