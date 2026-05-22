import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ParsedShipmentRequest {
  customer_name: string | null;
  origin_postal_code: string | null;
  origin_city: string | null;
  origin_country: string | null;
  destination_postal_code: string | null;
  destination_city: string | null;
  destination_country: string | null;
  weight_kg: number | null;
  cargo_type: string | null;
  vehicle_type: string | null;
  transport_mode: 'road' | 'sea' | null;
  loading_date: string | null;
  confidence_score: number;
  confidence: 'high' | 'medium' | 'low';
  language: 'ar' | 'tr' | 'en';
  needs_more_info: boolean;
  missing_fields: string[];
  raw_extraction: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are a logistics data extraction assistant. Your job is to parse incoming shipment request messages and extract structured data.

Extract the following fields for EACH shipment request:
- customer_name: Name of the company or person requesting the quote
- origin_postal_code: Postal code or ZIP code of the loading location
- origin_city: City of loading
- origin_country: Country of loading (use 2-letter ISO code if possible, or full name)
- destination_postal_code: Postal code of unloading location
- destination_city: City of unloading
- destination_country: Country of unloading (use 2-letter ISO code if possible, or full name)
- weight_kg: Weight in kilograms (convert tons to kg). Return as number.
- cargo_type: Type of cargo (e.g., "General Cargo", "Oversize", "Refrigerated", "Break bulk", "FTL")
- transport_mode: Transport mode requested - "road" for road/truck transport, "sea" for sea/maritime/container transport. If not specified, default to "road".
- vehicle_type: Requested vehicle type if mentioned (e.g., "optima", "mega", "kapalı kasa")
- loading_date: Loading date if mentioned (ISO format YYYY-MM-DD)
- language: Detected language of the message ("ar", "tr", or "en")
- confidence_score: Number between 0.0 and 1.0 indicating extraction confidence
- needs_more_info: Boolean. Set to TRUE if confidence_score < 0.7 OR any critical field is missing/unclear
- missing_fields: Array of field names that are missing or unclear (e.g., ["origin_postal_code", "weight_kg"]). Empty array if all good.

CRITICAL FIELDS: origin location, destination location, weight.
If ANY critical field is missing or ambiguous, confidence_score MUST be below 0.7 and needs_more_info MUST be true.

Confidence score guide:
- 0.9-1.0: All critical fields clearly present, specific values given
- 0.7-0.89: Most fields present but one minor field ambiguous
- 0.4-0.69: One or more critical fields missing or very ambiguous
- 0.0-0.39: Most information missing or completely unclear

MULTI-QUOTE DETECTION:
If the message contains multiple distinct shipment requests (e.g., "2 quotes for Le Havre→Poti AND Le Havre→Ashgabat"), return a JSON object with a key "routes" containing an array of route objects. Each route object should have the fields listed above.

If there is only ONE shipment request, return a single JSON object with the fields directly (no "routes" wrapper).

Return ONLY valid JSON. If a field is not found, use null.`;

function mapParsedItem(parsed: Record<string, unknown>): ParsedShipmentRequest {
  const confidenceScore = typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0;
  const missingFields = Array.isArray(parsed.missing_fields)
    ? parsed.missing_fields.filter((f): f is string => typeof f === 'string')
    : [];

  // Auto-determine needs_more_info if not explicitly set
  let needsMoreInfo = typeof parsed.needs_more_info === 'boolean' ? parsed.needs_more_info : false;
  if (confidenceScore < 0.7 || missingFields.length > 0) {
    needsMoreInfo = true;
  }

  // Determine confidence label from score
  let confidenceLabel: 'high' | 'medium' | 'low';
  if (confidenceScore >= 0.7) confidenceLabel = 'high';
  else if (confidenceScore >= 0.4) confidenceLabel = 'medium';
  else confidenceLabel = 'low';

  return {
    customer_name: typeof parsed.customer_name === 'string' ? parsed.customer_name : null,
    origin_postal_code: typeof parsed.origin_postal_code === 'string' ? parsed.origin_postal_code : null,
    origin_city: typeof parsed.origin_city === 'string' ? parsed.origin_city : null,
    origin_country: typeof parsed.origin_country === 'string' ? parsed.origin_country : null,
    destination_postal_code: typeof parsed.destination_postal_code === 'string' ? parsed.destination_postal_code : null,
    destination_city: typeof parsed.destination_city === 'string' ? parsed.destination_city : null,
    destination_country: typeof parsed.destination_country === 'string' ? parsed.destination_country : null,
    weight_kg: typeof parsed.weight_kg === 'number' ? parsed.weight_kg : typeof parsed.weight_kg === 'string' ? parseFloat(parsed.weight_kg) || null : null,
    cargo_type: typeof parsed.cargo_type === 'string' ? parsed.cargo_type : null,
    vehicle_type: typeof parsed.vehicle_type === 'string' ? parsed.vehicle_type : null,
    transport_mode: (parsed.transport_mode === 'sea' ? 'sea' : 'road') as 'road' | 'sea',
    loading_date: typeof parsed.loading_date === 'string' ? parsed.loading_date : null,
    confidence_score: confidenceScore,
    confidence: confidenceLabel,
    language: (parsed.language as 'ar' | 'tr' | 'en') ?? 'en',
    needs_more_info: needsMoreInfo,
    missing_fields: missingFields,
    raw_extraction: parsed,
  };
}

export async function parseShipmentMessages(
  messageText: string
): Promise<ParsedShipmentRequest[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: messageText },
    ],
    temperature: 0.1,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty response');
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;

  if (Array.isArray(parsed.routes)) {
    return parsed.routes.map((route) => mapParsedItem(route as Record<string, unknown>));
  }

  return [mapParsedItem(parsed)];
}

export async function parseShipmentMessage(
  messageText: string
): Promise<ParsedShipmentRequest> {
  const results = await parseShipmentMessages(messageText);
  return results[0];
}

export interface CustomerResponseInput {
  quote_id: number;
  origin_region: string;
  destination_region: string;
  final_price: number;
  currency: string;
  sea_final_price?: number;
  sea_currency?: string;
  is_dual_mode?: boolean;
  language: 'ar' | 'tr' | 'en';
  status: 'ready_to_send' | 'pending' | 'data_request' | 'approved' | 'rejected';
  review_reason?: string | null;
  is_oversize?: boolean;
  missing_fields?: string[];
}

const RESPONSE_SYSTEM_PROMPT = `You are a logistics customer service assistant. Generate a friendly, professional response message for a customer based on the provided quote status.

Return ONLY a JSON object with:
- message: The customer-facing message text
- language: The language code used

Rules:
- If status is "ready_to_send": Provide the quote with price, origin, destination. Be professional and invite them to confirm.
  - If is_dual_mode is true: Present BOTH road and sea prices clearly. Example: "Road: 5000 TRY | Sea: 4200 TRY". Mention that sea is typically slower but more cost-effective for heavy loads.
- If status is "approved": Confirm that the quote has been approved. Include the final price, origin, destination, and next steps.
- If status is "rejected": Politely inform them that we cannot provide a quote at this time. Include the reason if provided.
- If status is "pending": Explain that the request is being reviewed and they will receive a response soon.
- If status is "data_request": Politely ask for the missing information needed to provide a quote. List the missing fields clearly.
- If is_oversize is true: Mention that the shipment requires special handling due to weight.
- Use the customer's language (ar, tr, or en).
- Keep messages concise but professional.`;

export async function generateCustomerResponse(
  input: CustomerResponseInput
): Promise<{ message: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { message: `Quote #${input.quote_id} status: ${input.status}` };
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: RESPONSE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          quote_id: input.quote_id,
          origin_region: input.origin_region,
          destination_region: input.destination_region,
          final_price: input.final_price,
          currency: input.currency,
          sea_final_price: input.sea_final_price,
          sea_currency: input.sea_currency,
          is_dual_mode: input.is_dual_mode ?? false,
          language: input.language,
          status: input.status,
          review_reason: input.review_reason,
          is_oversize: input.is_oversize ?? false,
          missing_fields: input.missing_fields,
        }),
      },
    ],
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return { message: `Quote #${input.quote_id} status: ${input.status}` };
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return { message: typeof parsed.message === 'string' ? parsed.message : `Quote #${input.quote_id}` };
}

export interface VendorMessageInput {
  rfq_reference: string;
  target_country: string;
  origin_region: string;
  destination_region: string;
  weight_kg: number;
  cargo_type: string | null;
  vendor_name: string;
  language: 'ar' | 'tr' | 'en';
  channel: 'email' | 'whatsapp' | 'telegram';
}

const VENDOR_MESSAGE_PROMPT = `You are a logistics procurement assistant. Generate a clear, professional message to send to a freight vendor requesting a price quote.

Return ONLY a JSON object with:
- subject: Email subject line (if email) or empty string
- message: The full message text

Rules:
- Include the RFQ reference number prominently so the vendor can reply with it
- Include origin, destination, weight, and cargo type
- Ask for a price quote in TRY currency
- Keep it concise and professional
- Use the specified language (ar, tr, or en)
- For WhatsApp: Keep it shorter, more conversational
- For Email: More formal with proper greeting and signature
- End with a request to reply including the RFQ reference number`;

export async function generateVendorMessage(
  input: VendorMessageInput
): Promise<{ subject: string; message: string }> {
  // 1. Try custom template first
  const { renderVendorMessage } = await import('./vendor-messages');
  const custom = await renderVendorMessage(input.channel, {
    vendor_name: input.vendor_name,
    rfq_reference: input.rfq_reference,
    origin_region: input.origin_region,
    destination_region: input.destination_region,
    weight_kg: input.weight_kg,
    cargo_type: input.cargo_type,
    target_country: input.target_country,
  });
  if (custom) {
    return custom;
  }

  // 2. Fallback to OpenAI
  if (!process.env.OPENAI_API_KEY) {
    const msg = `[${input.rfq_reference}] Quote request: ${input.origin_region} → ${input.destination_region}, ${input.weight_kg}kg${input.cargo_type ? `, ${input.cargo_type}` : ''}. Please reply with price in TRY and include reference ${input.rfq_reference}.`;
    return { subject: `Quote Request ${input.rfq_reference}`, message: msg };
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VENDOR_MESSAGE_PROMPT },
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ],
    temperature: 0.2,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    const msg = `[${input.rfq_reference}] Quote request: ${input.origin_region} → ${input.destination_region}, ${input.weight_kg}kg${input.cargo_type ? `, ${input.cargo_type}` : ''}. Please reply with price in TRY and include reference ${input.rfq_reference}.`;
    return { subject: `Quote Request ${input.rfq_reference}`, message: msg };
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return {
    subject: typeof parsed.subject === 'string' ? parsed.subject : `Quote Request ${input.rfq_reference}`,
    message: typeof parsed.message === 'string' ? parsed.message : String(parsed.message ?? ''),
  };
}

export async function parseVendorReply(
  replyText: string
): Promise<{ rfq_reference: string | null; price: number | null; currency: string | null }> {
  if (!process.env.OPENAI_API_KEY) {
    return { rfq_reference: null, price: null, currency: null };
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Extract from this vendor reply:
1. RFQ reference number (usually starts with RFQ- or is a numeric ID)
2. Price amount (number only)
3. Currency code (3 letters, e.g. EUR, USD, TRY). Return null if not explicitly stated.

Important: Do NOT guess the currency. Only return a currency if the vendor explicitly mentions it (e.g., "1500 EUR", "$2000", "3000 USD"). If no currency is mentioned, return null.

Return ONLY JSON: {"rfq_reference": string|null, "price": number|null, "currency": string|null}`,
      },
      { role: 'user', content: replyText },
    ],
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return { rfq_reference: null, price: null, currency: null };

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return {
    rfq_reference: typeof parsed.rfq_reference === 'string' ? parsed.rfq_reference : null,
    price: typeof parsed.price === 'number' ? parsed.price : typeof parsed.price === 'string' ? parseFloat(parsed.price) || null : null,
    currency: typeof parsed.currency === 'string' ? parsed.currency : null,
  };
}
