import pool from './db';
import { getMasterLogicToggle } from './toggle';
import { calculatePricing, isOversize } from './pricing';
import { resolveRegionFromPostalCode, resolveCountryFromPostalCode, resolveCountryFromCity } from './geo';
import { selectVendorsForCountry } from './vendor-selector';
import { parseShipmentMessages, generateCustomerResponse, generateVendorMessage } from './openai';
import { logPricingEvent, logVendorEvent } from './audit';
import { sendMessage, sendWhatsAppTemplate } from './sender';
import { normalizeContactId } from './messaging-window';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { ParsedShipmentRequest } from './openai';

export interface ProcessRequestInput {
  customer_name?: string | null;
  customer_contact?: string | null;
  origin_postal_code?: string | null;
  destination_postal_code?: string | null;
  weight_kg?: number | null;
  cargo_type?: string | null;
  language?: 'ar' | 'tr' | 'en';
  channel?: 'whatsapp' | 'telegram' | 'email';
  raw_message?: string | null;
  handling_mode?: 'auto' | 'manual' | 'external';
}

export interface ProcessRequestResult {
  quote_id: number;
  status: 'pending' | 'ready_to_send' | 'sent' | 'data_request';
  handling_mode: 'auto' | 'manual' | 'external';
  origin_region: string;
  destination_region: string;
  base_price: number | null;
  markup_percent: number | null;
  final_price: number | null;
  currency: string;
  sea_base_price: number | null;
  sea_final_price: number | null;
  sea_currency: string | null;
  is_dual_mode: boolean;
  is_oversize: boolean;
  review_reason: string | null;
  rfq_id?: number | null;
  rfq_reference?: string | null;
  message: string;
  missing_fields?: string[];
}

function getWaitingPeriodSeconds(period: string): number {
  const match = period.match(/^(\d+)([mhd])$/);
  if (!match) return 30 * 60; // default 30 minutes
  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 60 * 60;
  if (unit === 'd') return value * 24 * 60 * 60;
  return 30 * 60;
}

async function getSystemSettings(): Promise<{
  toggle: string;
  waiting_period: string;
  default_currency: string;
  oversize_threshold_tons: number;
  global_markup_percent: number;
}> {
  const [rows] = await pool.execute<
    Array<RowDataPacket & {
      master_logic_toggle: string;
      waiting_period: string;
      default_currency: string;
      oversize_weight_threshold_tons: number;
      global_markup_percent: number;
    }>
  >('SELECT master_logic_toggle, waiting_period, default_currency, oversize_weight_threshold_tons, global_markup_percent FROM system_settings ORDER BY id DESC LIMIT 1');

  if (!rows || rows.length === 0) {
    return {
      toggle: 'manual_approval',
      waiting_period: '30m',
      default_currency: 'TRY',
      oversize_threshold_tons: 22,
      global_markup_percent: 0,
    };
  }

  return {
    toggle: rows[0].master_logic_toggle,
    waiting_period: rows[0].waiting_period,
    default_currency: rows[0].default_currency,
    oversize_threshold_tons: rows[0].oversize_weight_threshold_tons,
    global_markup_percent: rows[0].global_markup_percent ?? 0,
  };
}

export async function processIncomingRequest(
  input: ProcessRequestInput
): Promise<ProcessRequestResult[]> {
  const settings = await getSystemSettings();
  const toggle = await getMasterLogicToggle();

  // Step 1: Parse raw message if provided
  let parsedList: ParsedShipmentRequest[] = [];

  if (input.raw_message) {
    try {
      parsedList = await parseShipmentMessages(input.raw_message);
    } catch (e) {
      console.error('OpenAI parsing failed:', e);
    }
  }

  // Fallback: if no parsed routes but direct input provided, create one synthetic route
  if (parsedList.length === 0) {
    parsedList = [
      {
        customer_name: input.customer_name ?? null,
        origin_postal_code: input.origin_postal_code ?? null,
        origin_city: null,
        origin_country: null,
        destination_postal_code: input.destination_postal_code ?? null,
        destination_city: null,
        destination_country: null,
        weight_kg: input.weight_kg ?? null,
        cargo_type: input.cargo_type ?? null,
        vehicle_type: null,
        transport_mode: 'road',
        loading_date: null,
        confidence_score: 0,
        confidence: 'low',
        language: input.language ?? 'en',
        needs_more_info: true,
        missing_fields: ['origin_postal_code', 'destination_postal_code', 'weight_kg'],
        raw_extraction: {},
      },
    ];
  }

  const customerName = input.customer_name ?? parsedList[0]?.customer_name ?? null;
  const language = input.language ?? parsedList[0]?.language ?? 'en';
  const channel = input.channel ?? 'email';
  const handlingMode = input.handling_mode ?? 'auto';

  // Step 2: Persist shipment request (one per incoming message)
  const firstRoute = parsedList[0];
  const [insertResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO shipment_requests (customer_name, customer_contact, origin_postal_code, destination_postal_code, weight_kg, cargo_type, language, channel, raw_payload, raw_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerName,
      input.customer_contact ?? null,
      firstRoute?.origin_postal_code ?? null,
      firstRoute?.destination_postal_code ?? null,
      firstRoute?.weight_kg ?? null,
      firstRoute?.cargo_type ?? null,
      language,
      channel,
      JSON.stringify({ input, parsed: parsedList }),
      input.raw_message ?? null,
    ]
  );

  const shipmentRequestId = insertResult.insertId;

  // Step 3: Create a quote for each parsed route
  const results: ProcessRequestResult[] = [];

  for (const parsed of parsedList) {
    const result = await createQuoteForRoute({
      shipmentRequestId,
      parsed,
      input,
      settings,
      toggle,
      customerName,
      language,
      channel,
      handlingMode,
    });
    results.push(result);
  }

  return results;
}

interface CreateQuoteForRouteParams {
  shipmentRequestId: number;
  parsed: ParsedShipmentRequest;
  input: ProcessRequestInput;
  settings: {
    toggle: string;
    waiting_period: string;
    default_currency: string;
    oversize_threshold_tons: number;
    global_markup_percent: number;
  };
  toggle: string;
  customerName: string | null;
  language: 'ar' | 'tr' | 'en';
  channel: 'whatsapp' | 'telegram' | 'email';
  handlingMode: 'auto' | 'manual' | 'external';
}

const TEMPLATE_REQUEST_MORE_INFO: Record<string, string> = {
  en: 'Thank you for your request. To provide an accurate quote, please provide: Loading City/Country, Unloading City/Country, Loading Date, Weight.',
  tr: 'Talebiniz için teşekkürler. Doğru bir fiyat teklifi sunmak için lütfen şunları belirtin: Yükleme Şehri/Ülkesi, Boşaltma Şehri/Ülkesi, Yükleme Tarihi, Ağırlık.',
  ar: 'شكراً لطلبك. لتقديم عرض سعر دقيق، يرجى تقديم: مدينة/دولة التحميل، مدينة/دولة التفريغ، تاريخ التحميل، الوزن.',
};

async function createQuoteForRoute({
  shipmentRequestId,
  parsed,
  input,
  settings,
  toggle,
  language,
  channel,
  handlingMode,
}: CreateQuoteForRouteParams): Promise<ProcessRequestResult> {
  // Merge ALL fields: webhook input takes priority, then OpenAI parsed
  const customerName = input.customer_name ?? parsed.customer_name ?? null;
  const originPostalCode = input.origin_postal_code ?? parsed.origin_postal_code ?? null;
  const destinationPostalCode = input.destination_postal_code ?? parsed.destination_postal_code ?? null;
  const originCity = parsed.origin_city ?? null;
  const destinationCity = parsed.destination_city ?? null;
  const originCountry = parsed.origin_country ?? null;
  const destinationCountry = parsed.destination_country ?? null;
  const weightKg = input.weight_kg ?? parsed.weight_kg ?? null;
  const cargoType = input.cargo_type ?? parsed.cargo_type ?? null;

  // Determine the effective region names we'll use for pricing and display
  // Postal code resolution is preferred, but city/country names are perfectly valid
  const originRegionFromPostal = originPostalCode ? await resolveRegionFromPostalCode(originPostalCode, originCountry) : null;
  const destinationRegionFromPostal = destinationPostalCode ? await resolveRegionFromPostalCode(destinationPostalCode, destinationCountry) : null;

  const originRegionValue = originRegionFromPostal ?? originCity ?? originCountry ?? 'UNKNOWN';
  const destinationRegionValue = destinationRegionFromPostal ?? destinationCity ?? destinationCountry ?? 'UNKNOWN';

  // A location is "complete" if we have postal code, city, OR country
  const hasOriginLocation = !!(originPostalCode || originCity || originCountry);
  const hasDestinationLocation = !!(destinationPostalCode || destinationCity || destinationCountry);

  // Determine what is ACTUALLY missing after merging webhook + OpenAI
  const actuallyMissing: string[] = [];
  if (!hasOriginLocation) actuallyMissing.push('origin_location');
  if (!hasDestinationLocation) actuallyMissing.push('destination_location');
  if (!weightKg) actuallyMissing.push('weight_kg');

  // Only trigger data_request if CRITICAL fields are actually missing after merge
  // Ignore OpenAI's missing_fields — it doesn't know what the webhook already provided
  if (actuallyMissing.length > 0) {
    const [quoteResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO quotes (shipment_request_id, origin_region, destination_region, origin_postal_code, destination_postal_code, weight_kg, cargo_type, base_price, markup_percent, final_price, currency, sea_base_price, sea_markup_percent, sea_final_price, sea_currency, is_dual_mode, status, handling_mode, transport_mode, toggle_state_at_creation, is_oversize, review_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shipmentRequestId, originRegionValue, destinationRegionValue, originPostalCode, destinationPostalCode, weightKg, cargoType, 0, 0, 0, 'TRY', 0, 0, 0, 'TRY', false, 'pending', handlingMode, parsed.transport_mode ?? 'road', toggle, false, `Missing fields: ${actuallyMissing.join(', ')}`]
    );

    const quoteId = quoteResult.insertId;

    return {
      quote_id: quoteId,
      status: 'data_request',
      handling_mode: handlingMode,
      origin_region: String(originRegionValue),
      destination_region: String(destinationRegionValue),
      base_price: null,
      markup_percent: null,
      final_price: null,
      currency: 'TRY',
      sea_base_price: null,
      sea_final_price: null,
      sea_currency: null,
      is_dual_mode: false,
      is_oversize: false,
      review_reason: `Missing fields: ${actuallyMissing.join(', ')}`,
      message: '',
      missing_fields: actuallyMissing,
    };
  }

  // Check oversize
  const oversizeThresholdKg = settings.oversize_threshold_tons * 1000;
  const oversize = weightKg! > oversizeThresholdKg;

  // Calculate pricing using the best available region identifier
  // (postal-resolved region OR city name — both work for route_pricing lookup)
  let pricingResult: {
    basePrice: number;
    markupPercent: number;
    finalPrice: number;
    currency: string;
    found: boolean;
    seaBasePrice: number | null;
    seaMarkupPercent: number | null;
    seaFinalPrice: number | null;
    seaCurrency: string | null;
    hasBothModes: boolean;
  } = { basePrice: 0, markupPercent: 0, finalPrice: 0, currency: 'TRY', found: false, seaBasePrice: null, seaMarkupPercent: null, seaFinalPrice: null, seaCurrency: null, hasBothModes: false };

  if (originRegionValue !== 'UNKNOWN' && destinationRegionValue !== 'UNKNOWN') {
    pricingResult = await calculatePricing({
      originRegion: originRegionValue,
      destinationRegion: destinationRegionValue,
      weightKg: weightKg!,
      transportMode: parsed.transport_mode ?? 'road',
    });
  }

  // Determine quote status based on toggle and conditions
  let quoteStatus: 'pending' | 'ready_to_send' = 'pending';
  let reviewReason: string | null = null;

  if (oversize) {
    quoteStatus = 'pending';
    reviewReason = `Oversize Load: weight exceeds ${settings.oversize_threshold_tons} tons`;
  } else if (!pricingResult.found) {
    quoteStatus = 'pending';
    reviewReason = 'No internal route pricing available. RFQ initiated.';
  } else if (toggle === 'manual_approval') {
    quoteStatus = 'pending';
    reviewReason = 'Manual Approval mode is active';
  } else if (toggle === 'low_confidence_only') {
    if (parsed.confidence === 'low') {
      quoteStatus = 'pending';
      reviewReason = 'Low confidence parsing result';
    } else {
      quoteStatus = 'ready_to_send';
    }
  } else {
    // auto_send
    quoteStatus = 'ready_to_send';
  }

  // Insert quote
  const [quoteResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO quotes (shipment_request_id, origin_region, destination_region, origin_postal_code, destination_postal_code, weight_kg, cargo_type, base_price, markup_percent, final_price, currency, sea_base_price, sea_markup_percent, sea_final_price, sea_currency, is_dual_mode, status, handling_mode, transport_mode, toggle_state_at_creation, is_oversize, review_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      shipmentRequestId,
      originRegionValue,
      destinationRegionValue,
      originPostalCode,
      destinationPostalCode,
      weightKg,
      cargoType,
      pricingResult.basePrice,
      pricingResult.markupPercent,
      pricingResult.finalPrice,
      pricingResult.currency,
      pricingResult.seaBasePrice ?? 0,
      pricingResult.seaMarkupPercent ?? 0,
      pricingResult.seaFinalPrice ?? 0,
      pricingResult.seaCurrency ?? 'TRY',
      pricingResult.hasBothModes,
      quoteStatus,
      handlingMode,
      parsed.transport_mode ?? 'road',
      toggle,
      oversize,
      reviewReason,
    ]
  );

  const quoteId = quoteResult.insertId;

  // If no pricing found, create RFQ and notify ALL vendors
  let rfqId: number | null = null;
  let rfqReference: string | null = null;

  if (!pricingResult.found && !oversize) {
    // ─── Determine target country for vendor selection ───
    // Vendors are located at the ORIGIN — they pick up the cargo and ship it.
    // Fallback chain: parsed origin country → origin postal code → origin city → destination country (last resort)

    let targetCountry: string | null = parsed.origin_country ?? null;
    let targetCountrySource = 'parsed.origin_country';

    if (!targetCountry && originPostalCode) {
      targetCountry = await resolveCountryFromPostalCode(originPostalCode);
      if (targetCountry) targetCountrySource = 'origin_postal_code';
    }

    if (!targetCountry && originCity) {
      targetCountry = resolveCountryFromCity(originCity);
      if (targetCountry) targetCountrySource = 'origin_city';
    }

    if (!targetCountry && parsed.destination_country) {
      targetCountry = parsed.destination_country;
      targetCountrySource = 'destination_country (fallback)';
    }

    const finalTargetCountry = targetCountry ?? 'UNKNOWN';

    console.log(`[RFQ-AUTO] quote=${quoteId} origin="${originRegionValue}" dest="${destinationRegionValue}" targetCountry="${finalTargetCountry}" (source: ${targetCountrySource})`);

    // Select ALL active vendors for target country (no limit)
    const activeVendors = await selectVendorsForCountry(finalTargetCountry);

    if (activeVendors.length === 0) {
      // No vendors found for this route — update review reason to be honest
      reviewReason = `No internal pricing for ${originRegionValue} → ${destinationRegionValue}. No vendors found for ${finalTargetCountry}.`;
    }

    if (activeVendors.length > 0) {
      // Generate RFQ reference
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      rfqReference = `RFQ-${timestamp}-${random}`;

      const vendorIds = activeVendors.map((v) => v.id);

      // Create RFQ record
      const [rfqResult] = await pool.execute<ResultSetHeader>(
        `INSERT INTO rfq_records (quote_id, rfq_reference, target_country, selected_vendors, status)
         VALUES (?, ?, ?, ?, ?)`,
        [quoteId, rfqReference, finalTargetCountry, JSON.stringify(vendorIds), 'open']
      );

      rfqId = rfqResult.insertId;

      // Link quote to RFQ
      await pool.execute<ResultSetHeader>(
        `UPDATE quotes SET rfq_id = ? WHERE id = ?`,
        [rfqId, quoteId]
      );

      // Create vendor assignments and send messages via ALL preferred channels
      for (const vendor of activeVendors) {
        const channels = Array.isArray(vendor.preferred_channels)
          ? vendor.preferred_channels
          : typeof vendor.preferred_channels === 'string'
            ? JSON.parse(vendor.preferred_channels)
            : ['email'];

        for (const contactChannel of channels) {
          let contactId: string;
          if (contactChannel === 'whatsapp') {
            contactId = vendor.contact_phone ?? '';
          } else if (contactChannel === 'telegram') {
            contactId = vendor.telegram_chat_id ?? '';
          } else {
            contactId = vendor.contact_email ?? '';
          }

          if (!contactId) continue;

          // Normalize WhatsApp contact IDs so they match incoming webhook format
          if (contactChannel === 'whatsapp') {
            contactId = normalizeContactId(contactId, 'whatsapp');
          }

          await pool.execute<ResultSetHeader>(
            `INSERT INTO rfq_vendor_assignments (rfq_id, vendor_id, contact_channel, contact_id, status)
             VALUES (?, ?, ?, ?, ?)`,
            [rfqId, vendor.id, contactChannel, contactId, 'pending']
          );

          let sendResult: { success: boolean; messageId?: string | number; error?: string };
          let sentMessage: string;

          if (contactChannel === 'whatsapp') {
            // WhatsApp Business API requires an APPROVED TEMPLATE for business-initiated messages.
            // Free-form text will fail with error 131030 if the vendor hasn't messaged in 24h.
            // Template: logistics_rfq_request (must be created in Meta Business Manager)
            const templateParams = [
              vendor.name,                      // {{1}} Vendor name
              String(originRegionValue),        // {{2}} Origin
              String(destinationRegionValue),   // {{3}} Destination
              `${weightKg!.toLocaleString()} kg`, // {{4}} Weight
              cargoType ?? 'General Cargo',     // {{5}} Cargo type
              rfqReference!,                    // {{6}} RFQ reference
            ];

            sendResult = await sendWhatsAppTemplate(
              contactId,
              'logistics_rfq_request',
              'en',
              templateParams
            );
            sentMessage = `[Template: logistics_rfq_request] ${templateParams.join(' | ')}`;
          } else {
            // Email / Telegram: free-form text works fine
            const msg = await generateVendorMessage({
              rfq_reference: rfqReference,
              target_country: finalTargetCountry,
              origin_region: String(originRegionValue),
              destination_region: String(destinationRegionValue),
              weight_kg: weightKg!,
              cargo_type: cargoType,
              vendor_name: vendor.name,
              language,
              channel: contactChannel as 'email' | 'whatsapp' | 'telegram',
            });
            sentMessage = msg.message;

            sendResult = await sendMessage({
              channel: contactChannel as 'whatsapp' | 'telegram' | 'email',
              contactId,
              message: msg.message,
              subject: msg.subject,
            });
          }

          await logVendorEvent({
            event_type: sendResult.success ? 'vendor_rfq_sent' : 'vendor_rfq_send_failed',
            quote_id: quoteId,
            vendor_id: vendor.id,
            details: {
              rfq_reference: rfqReference,
              channel: contactChannel,
              contact_id: contactId,
              message: sentMessage,
              sent: sendResult.success,
              error: sendResult.error ?? null,
            },
          });
        }
      }

      await logPricingEvent({
        event_type: 'rfq_initiated',
        quote_id: quoteId,
        details: { target_country: targetCountry, vendor_count: activeVendors.length, rfq_reference: rfqReference },
      });
    } else if (activeVendors.length === 0) {
      // Update quote with honest review reason (no vendors found)
      await pool.execute(
        `UPDATE quotes SET review_reason = ? WHERE id = ?`,
        [reviewReason, quoteId]
      );
    }
  }

  // Log quote creation
  await logPricingEvent({
    event_type: quoteStatus === 'ready_to_send' ? 'quote_ready' : 'quote_created',
    quote_id: quoteId,
    details: { toggle, base_price: pricingResult.basePrice, final_price: pricingResult.finalPrice, handling_mode: handlingMode },
  });

  // Only send initial response to customer when quote is ACTUALLY ready (internal pricing + auto-send toggle).
  // Do NOT send "we're reviewing" messages for pending/RFQ/oversize/manual-approval states.
  // Customer will hear back when: admin approves/rejects, or RFQ cron auto-closes with vendor price.
  let customerResponseMessage = '';
  let finalQuoteStatus: 'pending' | 'ready_to_send' | 'sent' = rfqId ? 'pending' : quoteStatus;

  if (quoteStatus === 'ready_to_send' && !rfqId) {
    const customerResponse = await generateCustomerResponse({
      quote_id: quoteId,
      origin_region: String(originRegionValue),
      destination_region: String(destinationRegionValue),
      final_price: pricingResult.finalPrice,
      currency: pricingResult.currency,
      sea_final_price: pricingResult.seaFinalPrice ?? undefined,
      sea_currency: pricingResult.seaCurrency ?? undefined,
      is_dual_mode: pricingResult.hasBothModes,
      language,
      status: 'ready_to_send',
      review_reason: reviewReason,
      is_oversize: oversize,
    });
    customerResponseMessage = customerResponse.message;

    if (input.customer_contact) {
      const sendInput: Parameters<typeof sendMessage>[0] = {
        channel,
        contactId: input.customer_contact,
        message: customerResponse.message,
      };

      // WhatsApp: fallback to approved template if outside 24h window
      if (channel === 'whatsapp') {
        sendInput.whatsappTemplate = {
          name: 'logistics_quote_approved',
          languageCode: 'en',
          bodyParameters: [
            String(originRegionValue),
            String(destinationRegionValue),
            `${pricingResult.finalPrice.toLocaleString('en-US')} ${pricingResult.currency}`,
          ],
        };
      }

      const sendResult = await sendMessage(sendInput);

      if (sendResult.success) {
        finalQuoteStatus = 'sent';
        await pool.execute(
          `UPDATE quotes SET status = 'sent' WHERE id = ?`,
          [quoteId]
        );
      } else {
        // Send failed — keep ready_to_send and record error so admin can see
        await pool.execute(
          `UPDATE quotes SET review_reason = CONCAT(IFNULL(review_reason, ''), ' [SEND FAILED: ', ?, ']') WHERE id = ?`,
          [sendResult.error ?? 'Unknown error', quoteId]
        );
      }

      await logPricingEvent({
        event_type: sendResult.success ? 'customer_response_sent' : 'customer_response_failed',
        quote_id: quoteId,
        details: {
          channel,
          contact: input.customer_contact,
          message: customerResponse.message,
          sent: sendResult.success,
          error: sendResult.error ?? null,
        },
      });
    }
  }

  return {
    quote_id: quoteId,
    status: finalQuoteStatus,
    handling_mode: handlingMode,
    origin_region: String(originRegionValue),
    destination_region: String(destinationRegionValue),
    base_price: pricingResult.found ? pricingResult.basePrice : null,
    markup_percent: pricingResult.found ? pricingResult.markupPercent : null,
    final_price: pricingResult.found ? pricingResult.finalPrice : null,
    currency: pricingResult.currency,
    sea_base_price: pricingResult.found ? pricingResult.seaBasePrice : null,
    sea_final_price: pricingResult.found ? pricingResult.seaFinalPrice : null,
    sea_currency: pricingResult.seaCurrency ?? null,
    is_dual_mode: pricingResult.hasBothModes,
    is_oversize: oversize,
    review_reason: reviewReason,
    rfq_id: rfqId,
    rfq_reference: rfqReference,
    message: customerResponseMessage,
  };
}

export async function processExpiredRFQs(): Promise<{
  processed: number;
  results: Array<{ rfq_id: number; quote_id: number; status: string; lowest_price?: number; final_price?: number; vendor_id?: number }>;
}> {
  const settings = await getSystemSettings();
  const waitingSeconds = getWaitingPeriodSeconds(settings.waiting_period);
  const globalMarkupMultiplier = 1 + (settings.global_markup_percent / 100);

  // Find RFQs past their waiting period that haven't been closed yet
  const [rows] = await pool.execute<
    Array<RowDataPacket & { id: number; quote_id: number; created_at: string; rfq_reference: string }>
  >(
    `SELECT id, quote_id, created_at, rfq_reference
     FROM rfq_records
     WHERE status IN ('open', 'responded')
       AND created_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [waitingSeconds]
  );

  const results: Array<{ rfq_id: number; quote_id: number; status: string; lowest_price?: number; final_price?: number; vendor_id?: number }> = [];

  for (const rfq of rows || []) {
    // Get vendor responses for this RFQ
    const [responseRows] = await pool.execute<
      Array<RowDataPacket & {
        vendor_id: number;
        response_price: number;
        response_currency: string;
      }>
    >(
      `SELECT vendor_id, response_price, response_currency
       FROM rfq_vendor_assignments
       WHERE rfq_id = ? AND status = 'responded' AND response_price IS NOT NULL`,
      [rfq.id]
    );

    if (!responseRows || responseRows.length === 0) {
      // No responses after waiting period — admin needs to handle manually
      // Leave status as-is so it stays visible in RFQ list
      results.push({ rfq_id: rfq.id, quote_id: rfq.quote_id, status: 'no_responses' });
      continue;
    }

    // Find lowest price (keep original currency — no exchange rate conversion)
    let lowestPrice = Infinity;
    let lowestCurrency = 'TRY';
    let selectedVendorId = 0;

    for (const resp of responseRows) {
      const price = typeof resp.response_price === 'string' ? parseFloat(resp.response_price) : resp.response_price;
      if (price < lowestPrice) {
        lowestPrice = price;
        lowestCurrency = resp.response_currency;
        selectedVendorId = resp.vendor_id;
      }
    }

    // Determine markup: vendor-specific or global
    const [vendorMarginRows] = await pool.execute<
      Array<RowDataPacket & { use_custom_margin: number; margin_rate: number }>
    >(
      'SELECT use_custom_margin, margin_rate FROM vendors WHERE id = ? LIMIT 1',
      [selectedVendorId]
    );
    const vendorMargin = vendorMarginRows?.[0];
    const useVendorMargin = vendorMargin?.use_custom_margin === 1;
    const appliedMarkupPercent = useVendorMargin ? vendorMargin.margin_rate : settings.global_markup_percent;
    const appliedMultiplier = 1 + appliedMarkupPercent / 100;
    const finalPrice = lowestPrice * appliedMultiplier;

    // Check the toggle mode that was active when the quote was created
    const [toggleRows] = await pool.execute<
      Array<RowDataPacket & { toggle_state_at_creation: string }>
    >(
      'SELECT toggle_state_at_creation FROM quotes WHERE id = ? LIMIT 1',
      [rfq.quote_id]
    );
    const toggleAtCreation = toggleRows?.[0]?.toggle_state_at_creation ?? 'auto_send';
    const isManualMode = toggleAtCreation === 'manual_approval';

    // In manual mode: calculate price but keep quote PENDING for admin review
    // In auto/low-confidence mode: set to ready_to_send and notify customer
    const quoteStatus = isManualMode ? 'pending' : 'ready_to_send';
    const marginSource = useVendorMargin ? 'vendor' : 'global';
    const newReviewReason = isManualMode
      ? `RFQ closed. Lowest bid: ${lowestPrice} ${lowestCurrency} → Final: ${finalPrice} ${lowestCurrency} (${marginSource} margin: ${appliedMarkupPercent}%). Waiting for admin approval.`
      : null;

    // Update quote (store in vendor's original currency)
    await pool.execute(
      `UPDATE quotes SET base_price = ?, markup_percent = ?, final_price = ?, currency = ?, status = ?, review_reason = ? WHERE id = ?`,
      [lowestPrice, appliedMarkupPercent, finalPrice, lowestCurrency, quoteStatus, newReviewReason, rfq.quote_id]
    );

    // Update RFQ
    await pool.execute(
      `UPDATE rfq_records SET generated_quote_price = ?, selected_vendor_id = ?, status = 'closed' WHERE id = ?`,
      [finalPrice, selectedVendorId, rfq.id]
    );

    // Only notify customer in auto/low-confidence mode.
    // In manual mode, admin must review and approve/reject first.
    if (!isManualMode) {
      const [customerRows] = await pool.execute<
        Array<RowDataPacket & { customer_contact: string | null; channel: string; language: string; origin_region: string; destination_region: string; is_dual_mode: boolean; sea_final_price: number; sea_currency: string }>
      >(
        `SELECT s.customer_contact, s.channel, s.language, q.origin_region, q.destination_region, q.is_dual_mode, q.sea_final_price, q.sea_currency
         FROM quotes q
         JOIN shipment_requests s ON s.id = q.shipment_request_id
         WHERE q.id = ?`,
        [rfq.quote_id]
      );

      const customer = customerRows?.[0];
      if (customer?.customer_contact) {
        const customerResponse = await generateCustomerResponse({
          quote_id: rfq.quote_id,
          origin_region: customer.origin_region,
          destination_region: customer.destination_region,
          final_price: finalPrice,
          currency: lowestCurrency,
          sea_final_price: customer.is_dual_mode ? customer.sea_final_price : undefined,
          sea_currency: customer.is_dual_mode ? customer.sea_currency : undefined,
          is_dual_mode: customer.is_dual_mode,
          language: (customer.language as 'ar' | 'tr' | 'en') ?? 'en',
          status: 'ready_to_send',
        });

        const sendInput: Parameters<typeof sendMessage>[0] = {
          channel: customer.channel as 'whatsapp' | 'telegram' | 'email',
          contactId: customer.customer_contact,
          message: customerResponse.message,
        };

        // WhatsApp: fallback to approved template if outside 24h window
        if (customer.channel === 'whatsapp') {
          sendInput.whatsappTemplate = {
            name: 'logistics_quote_approved',
            languageCode: 'en',
            bodyParameters: [
              customer.origin_region,
              customer.destination_region,
              `${finalPrice.toLocaleString('en-US')} ${lowestCurrency}`,
            ],
          };
        }

        const sendResult = await sendMessage(sendInput);

        if (sendResult.success) {
          await pool.execute(
            `UPDATE quotes SET status = 'sent' WHERE id = ?`,
            [rfq.quote_id]
          );
        } else {
          await pool.execute(
            `UPDATE quotes SET review_reason = CONCAT(IFNULL(review_reason, ''), ' [SEND FAILED: ', ?, ']') WHERE id = ?`,
            [sendResult.error ?? 'Unknown error', rfq.quote_id]
          );
        }

        await logPricingEvent({
          event_type: sendResult.success ? 'customer_rfq_ready_sent' : 'customer_rfq_ready_failed',
          quote_id: rfq.quote_id,
          details: {
            channel: customer.channel,
            contact: customer.customer_contact,
            final_price: finalPrice,
            vendor_id: selectedVendorId,
            sent: sendResult.success,
            error: sendResult.error ?? null,
          },
        });
      }
    } else {
      console.log(`[RFQ-CRON] Manual approval mode — skipping customer notification for quote ${rfq.quote_id}`);
    }

    results.push({
      rfq_id: rfq.id,
      quote_id: rfq.quote_id,
      status: 'closed_auto',
      lowest_price: lowestPrice,
      final_price: finalPrice,
      vendor_id: selectedVendorId,
    });

    await logPricingEvent({
      event_type: 'rfq_quote_generated',
      quote_id: rfq.quote_id,
      details: {
        vendor_id: selectedVendorId,
        vendor_price: lowestPrice,
        vendor_currency: lowestCurrency,
        converted_price: lowestPrice,
        global_markup_percent: settings.global_markup_percent,
        final_price: finalPrice,
        auto: true,
      },
    });
  }

  return { processed: results.length, results };
}

function inferContactChannel(contactId: string): 'whatsapp' | 'email' | 'telegram' {
  if (contactId.includes('@')) return 'email';
  if (/^\d+$/.test(contactId.replace(/\D/g, ''))) return 'whatsapp';
  return 'telegram';
}

export async function processVendorReply(
  contactId: string,
  replyText: string
): Promise<{ success: boolean; message: string; matched?: boolean }> {
  // Step 1: Try to parse RFQ reference from reply
  const parsedReply = await import('./openai').then((m) => m.parseVendorReply(replyText));

  // Detect channel from contact ID format
  const inferredChannel = inferContactChannel(contactId);
  console.log(`[VENDOR-REPLY] Inferred channel: ${inferredChannel} from contact: ${contactId}`);

  // Build contact variants based on channel type
  let uniqueContacts: string[];
  if (inferredChannel === 'email') {
    // Email: try exact match and lowercase variant
    uniqueContacts = Array.from(new Set([contactId, contactId.toLowerCase(), contactId.trim()]));
  } else {
    // WhatsApp/Telegram: normalize phone number variants
    const normalizedContact = normalizeContactId(contactId, 'whatsapp');
    const digitsOnly = contactId.replace(/\D/g, '');
    uniqueContacts = Array.from(new Set([contactId, normalizedContact, digitsOnly, `+${digitsOnly}`, `whatsapp:+${digitsOnly}`].filter(Boolean)));
  }

  console.log(`[VENDOR-REPLY] Contact variants to try:`, uniqueContacts);

  let assignment: { id: number; rfq_id: number; vendor_id: number } | null = null;

  // Step 2: If RFQ reference found, look up by reference
  if (parsedReply.rfq_reference) {
    console.log(`[VENDOR-REPLY] Looking up RFQ by reference: ${parsedReply.rfq_reference}`);
    const [rfqRows] = await pool.execute<
      Array<RowDataPacket & { id: number }>
    >(
      `SELECT id FROM rfq_records WHERE rfq_reference = ? AND status IN ('open', 'responded') LIMIT 1`,
      [parsedReply.rfq_reference]
    );

    if (rfqRows && rfqRows.length > 0) {
      console.log(`[VENDOR-REPLY] Found RFQ id=${rfqRows[0].id}, looking for assignment...`);
      // Try each contact variant
      for (const variant of uniqueContacts) {
        const [assignmentRows] = await pool.execute<
          Array<RowDataPacket & { id: number; rfq_id: number; vendor_id: number }>
        >(
          `SELECT id, rfq_id, vendor_id FROM rfq_vendor_assignments
           WHERE rfq_id = ? AND contact_id = ?
           ORDER BY created_at DESC LIMIT 1`,
          [rfqRows[0].id, variant]
        );

        if (assignmentRows && assignmentRows.length > 0) {
          assignment = assignmentRows[0];
          console.log(`[VENDOR-REPLY] Matched assignment ${assignment.id} with contact variant: ${variant}`);
          break;
        }
      }
      if (!assignment) {
        console.log(`[VENDOR-REPLY] No assignment found for RFQ ${rfqRows[0].id} with any contact variant`);
      }
    } else {
      console.log(`[VENDOR-REPLY] No open RFQ found with reference ${parsedReply.rfq_reference}`);
    }
  }

  // Step 3: If no match by reference, look up latest open RFQ for this contact within 4 hours
  if (!assignment) {
    console.log(`[VENDOR-REPLY] No match by reference, trying contact-only lookup...`);
    const placeholders = uniqueContacts.map(() => '?').join(',');
    const [assignmentRows] = await pool.execute<
      Array<RowDataPacket & { id: number; rfq_id: number; vendor_id: number }>
    >(
      `SELECT a.id, a.rfq_id, a.vendor_id
       FROM rfq_vendor_assignments a
       JOIN rfq_records r ON r.id = a.rfq_id
       WHERE a.contact_id IN (${placeholders})
         AND r.status IN ('open', 'responded')
         AND a.created_at >= DATE_SUB(NOW(), INTERVAL 4 HOUR)
       ORDER BY a.created_at DESC`,
      uniqueContacts
    );

    if (assignmentRows && assignmentRows.length === 1) {
      // Exactly one match — use it
      assignment = assignmentRows[0];
    } else     if (assignmentRows && assignmentRows.length > 1) {
      // Multiple open RFQs — ambiguous, store as unmatched
      await storeUnmatchedReply(contactId, inferredChannel, replyText, parsedReply.price, parsedReply.currency, 'Multiple open RFQs found for this contact');
      return { success: false, message: 'Multiple open RFQs found for this contact. Stored for manual review.', matched: false };
    }
  }

  // Step 4: If still no assignment, store as unmatched
  if (!assignment) {
    await storeUnmatchedReply(contactId, inferredChannel, replyText, parsedReply.price, parsedReply.currency, 'No open RFQ found for this contact');
    return { success: false, message: 'No open RFQ found for this contact. Stored for manual review.', matched: false };
  }

  // Step 5: Extract price from reply
  let responsePrice = parsedReply.price;
  let responseCurrency = parsedReply.currency ?? 'TRY';

  // Fallback: try regex extraction
  if (!responsePrice) {
    const priceMatch = replyText.match(/(\d[\d.,]*\d)\s*(EUR|USD|TRY|GBP|€|\$|₺)?/i);
    if (priceMatch) {
      responsePrice = parseFloat(priceMatch[1].replace(/,/g, ''));
      responseCurrency = priceMatch[2] ? priceMatch[2].toUpperCase() : 'TRY';
      if (responseCurrency === '€') responseCurrency = 'EUR';
      if (responseCurrency === '$') responseCurrency = 'USD';
      if (responseCurrency === '₺') responseCurrency = 'TRY';
    }
  }

  if (!responsePrice) {
    await storeUnmatchedReply(contactId, inferredChannel, replyText, null, null, 'Could not extract price from reply');
    return { success: false, message: 'Could not extract price from vendor reply. Stored for manual review.', matched: false };
  }

  // Step 6: Update assignment
  await pool.execute(
    `UPDATE rfq_vendor_assignments
     SET response_price = ?, response_currency = ?, responded_at = NOW(), status = 'responded'
     WHERE id = ?`,
    [responsePrice, responseCurrency, assignment.id]
  );

  // DO NOT change RFQ status here. Keep it 'open' so the cron can still process it
  // when the waiting period expires. The cron will pick the lowest bid among ALL vendors.
  // If we set it to 'responded' here, the cron will never auto-close it.

  await logVendorEvent({
    event_type: 'vendor_response_received',
    quote_id: assignment.rfq_id,
    vendor_id: assignment.vendor_id,
    details: { price: responsePrice, currency: responseCurrency, contact_id: contactId, matched: true },
  });

  return {
    success: true,
    message: `Recorded response: ${responsePrice} ${responseCurrency} for RFQ ${parsedReply.rfq_reference ?? assignment.rfq_id}`,
    matched: true,
  };
}

async function storeUnmatchedReply(
  contactId: string,
  contactChannel: string,
  replyText: string,
  parsedPrice: number | null,
  parsedCurrency: string | null,
  reason: string
): Promise<void> {
  await pool.execute(
    `INSERT INTO unmatched_vendor_replies (contact_id, contact_channel, reply_text, parsed_price, parsed_currency, status, resolution_notes)
     VALUES (?, ?, ?, ?, ?, 'unmatched', ?)`,
    [contactId, contactChannel, replyText, parsedPrice, parsedCurrency, reason]
  );

  await logVendorEvent({
    event_type: 'vendor_response_received',
    quote_id: 0,
    vendor_id: null,
    details: {
      contact_id: contactId,
      reply_text: replyText.substring(0, 500),
      parsed_price: parsedPrice,
      parsed_currency: parsedCurrency,
      status: 'unmatched',
      reason,
    },
  });
}
