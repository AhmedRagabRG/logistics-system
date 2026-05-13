# Logistics Dashboard — Complete System Documentation

> **Version:** Current as of 2026-05-03  
> **Stack:** Next.js 16 + React 19 + MySQL + OpenAI GPT-4o + Meta WhatsApp API + Telegram Bot API + Outlook SMTP

---

## 1. Architecture Overview

```
Customer Message
    │ (WhatsApp / Telegram / Email / API)
    ▼
Webhook Endpoint
    │
    ▼
OpenAI Parser (parseShipmentMessages)
    │ ──► Detects single or MULTIPLE quotes in one message
    │
    ▼
Automation Engine (processIncomingRequest)
    │ ──► Creates 1 shipment_request + N quotes (one per route)
    │
    ├─ Route COVERED in DB? ──► Auto-price ──► Quote status = pending/ready
    │
    └─ Route NOT covered? ──► Create RFQ ──► Message vendors ──► Quote status = pending
    │
    ▼
Dashboard (quotes list + detail + review)
    │
    ▼
Admin Approves / Rejects
    │
    ▼
Auto-generate customer response (via OpenAI) ──► Send back to customer's channel
```

---

## 2. Database Schema (Key Tables)

### `shipment_requests` — One per incoming message
| Column | Purpose |
|--------|---------|
| `customer_name` | Company or person name (from message or webhook) |
| `customer_contact` | **WhatsApp number / Telegram chat ID / Email** — used for replies |
| `raw_message` | **Full original message text** — shown in dashboard |
| `origin_postal_code` | Parsed from message (nullable) |
| `destination_postal_code` | Parsed from message (nullable) |
| `weight_kg` | Parsed weight in kg (nullable) |
| `cargo_type` | General Cargo, Oversize, Refrigerated, etc. |
| `channel` | `whatsapp` / `telegram` / `email` |
| `language` | `ar` / `tr` / `en` |
| `raw_payload` | JSON dump of parsed data + input |

### `quotes` — One per detected route
| Column | Purpose |
|--------|---------|
| `shipment_request_id` | Links back to the parent request |
| `origin_region` | Resolved from postal code, or city/country fallback |
| `destination_region` | Resolved from postal code, or city/country fallback |
| `origin_postal_code` | Copied per-quote (supports multi-quote) |
| `destination_postal_code` | Copied per-quote |
| `weight_kg` | Copied per-quote |
| `cargo_type` | Copied per-quote |
| `base_price` | From `route_pricing` table |
| `markup_percent` | From `route_pricing` table |
| `final_price` | base_price × (1 + markup/100) |
| `currency` | Always TRY (default) |
| `status` | `pending` → `approved` / `rejected` / `ready_to_send` |
| `handling_mode` | `auto` / `manual` / `external` |
| `toggle_state_at_creation` | Snapshot of system toggle when quote was created |
| `is_oversize` | TRUE if weight > threshold (default 22 tons) |
| `review_reason` | Why it's pending (e.g. "No internal route pricing available") |
| `response_text` | Auto-generated or admin-written customer reply |
| `rfq_id` | **If set → route not covered, RFQ was created** |
| `approved_by` | Admin who processed the quote |

### `route_pricing` — Internal pricing matrix
| Column | Purpose |
|--------|---------|
| `origin_region` | e.g. `DE-North`, `SI-West` |
| `destination_region` | e.g. `DE-North`, `SI-West` |
| `base_price` | Price in TRY |
| `markup_percent` | System margin % |
| `is_active` | Only active routes are matched |

**Current coverage (seed data):**
- `DE-North` ↔ `SI-West`, `SI-East`
- `DE-South` ↔ `SI-West`, `SI-East`
- `DE-North` ↔ `HR-North`, `HR-South`
- `AT-East` ↔ `SI-West`
- `CH-North` ↔ `SI-East`

### `vendors` — Freight vendor network
| Column | Purpose |
|--------|---------|
| `name` | Company name |
| `country_coverage` | Comma-separated ISO codes (e.g. `SI,HR,BA`) |
| `priority_ranking` | Lower = higher priority |
| `margin_rate` | Vendor-specific margin % |
| `contact_email` | For email RFQs |
| `contact_phone` | For WhatsApp RFQs |
| `preferred_channels` | JSON array: `["email"]` or `["whatsapp"]` or both |
| `is_active` | Only active vendors are selected |

### `rfq_records` — Vendor failover tracking
| Column | Purpose |
|--------|---------|
| `quote_id` | Links to the quote that triggered this RFQ |
| `rfq_reference` | Unique ID like `RFQ-20260503-042` |
| `target_country` | Destination country code (for vendor matching) |
| `selected_vendors` | JSON array of vendor IDs contacted |
| `status` | `open` → `responded` → `closed` |

### `rfq_vendor_assignments` — Per-vendor contact tracking
| Column | Purpose |
|--------|---------|
| `rfq_id` | Parent RFQ |
| `vendor_id` | Which vendor |
| `contact_channel` | `email` or `whatsapp` |
| `contact_id` | Phone number or email address |
| `response_price` | Price vendor replied with |
| `response_currency` | Vendor's currency |
| `status` | `pending` / `responded` |

---

## 3. How a Message Becomes a Quote

### Step 1: Message Arrives
Customer sends a message via **WhatsApp**, **Telegram**, or **Email**.

### Step 2: Webhook Receives It
- **Telegram** → `POST /api/webhooks/telegram`
- **WhatsApp** → `POST /api/webhooks/whatsapp`
- **Email** → `POST /api/webhooks/email`

Webhooks extract:
- `raw_message`: The full text
- `customer_name`: Sender name or email
- `customer_contact`: Chat ID / phone / email (for replies)
- `channel`: `telegram` / `whatsapp` / `email`

### Step 3: OpenAI Parses the Message
`lib/openai.ts` → `parseShipmentMessages(messageText)` sends the text to GPT-4o with this prompt:

> Extract: customer_name, origin_postal_code, origin_city, origin_country, destination_postal_code, destination_city, destination_country, weight_kg, cargo_type, vehicle_type, loading_date, language, confidence
>
> **MULTI-QUOTE DETECTION:** If the message contains multiple distinct shipment requests (e.g. "2 quotes for Le Havre→Poti AND Le Havre→Ashgabat"), return a JSON object with key `routes` containing an array of route objects.

**Returns:** Array of `ParsedShipmentRequest[]` — one per detected route.

### Step 4: Shipment Request Created
`lib/automation-engine.ts` → `processIncomingRequest()`

Creates **ONE** `shipment_request` row with:
- `raw_message` stored
- `customer_contact` stored
- First route's data as defaults

### Step 5: Quote(s) Created
For **each** detected route, creates a separate `quote` row with:
- `origin_postal_code`, `destination_postal_code`, `weight_kg`, `cargo_type`
- Regions resolved via `postal_codes` table (prefix match on first 2 digits)

---

## 4. How We Know If a Route Is Covered

`lib/pricing.ts` → `calculatePricing()` runs:

```sql
SELECT base_price, markup_percent, currency
FROM route_pricing
WHERE origin_region = ? AND destination_region = ? AND is_active = TRUE
LIMIT 1
```

**If row exists:** `found: true` → price calculated → quote status depends on toggle  
**If NO row:** `found: false` → quote gets `review_reason = "No internal route pricing available. RFQ initiated."` → **RFQ created**

**Important:** Postal codes resolve to regions via `postal_codes` table. If a postal code prefix is not in the table, the region becomes the city/country name from OpenAI parsing, which is unlikely to match `route_pricing`.

---

## 5. RFQ Flow (When Route Is Not Covered)

### Step 1: Select Vendors
`lib/vendor-selector.ts` → `selectTopVendors(targetCountry, limit)`

Finds vendors where:
- `country_coverage` CONTAINS the destination country
- `is_active = TRUE`
- Sorted by `priority_ranking ASC`

### Step 2: Generate RFQ Reference
```
RFQ-YYYYMMDD-NNN
```
Example: `RFQ-20260503-042`

### Step 3: Create RFQ Record
- Inserts into `rfq_records`
- Links `quotes.rfq_id` to the new RFQ

### Step 4: Generate & Send Messages
For each vendor, for each `preferred_channels`:

1. **Generate message** via OpenAI (`generateVendorMessage`):
   - Includes RFQ reference prominently
   - Includes origin, destination, weight, cargo type
   - Language matches the customer's language
   - WhatsApp version: shorter, conversational
   - Email version: formal with subject line

2. **Send the message** via `lib/sender.ts`:
   - `whatsapp` → Meta Cloud API (`graph.facebook.com`)
   - `email` → Outlook SMTP via Nodemailer
   - `telegram` → Bot API (`api.telegram.org`)

3. **Log the send** in `system_logs`:
   - Event type: `vendor_rfq_sent` (success) or `vendor_rfq_send_failed`
   - Includes channel, contact, message text

### Step 5: Vendor Replies
Vendors reply via their channel. The reply is forwarded to:

`POST /api/webhooks/vendor-reply`

Body:
```json
{
  "contact_id": "+38612345678",
  "reply_text": "Price is 1500 TRY ref RFQ-20260503-042"
}
```

The system:
1. Finds the latest open RFQ for this contact
2. Parses price via OpenAI (`parseVendorReply`) + regex fallback
3. Updates `rfq_vendor_assignments` with `response_price` and `status = 'responded'`
4. Updates `rfq_records.status = 'responded'`

### Step 6: Auto-Close Expired RFQs
Cron hits `GET /api/v1/rfqs/process-timeouts`

Finds RFQs past `waiting_period` (default 30m):
- **No responses:** Mark as `no_responses`
- **Has responses:** Pick lowest price → update quote with vendor price → mark `ready_to_send`

---

## 6. Quote Status & System Toggle

`System Settings` → `master_logic_toggle` controls automation behavior:

| Toggle | Behavior |
|--------|----------|
| `auto_send` | If route covered + not oversize → status = `ready_to_send` immediately |
| `low_confidence_only` | If route covered + confidence = `high` → `ready_to_send`; else `pending` |
| `manual_approval` | **ALL quotes start as `pending`** (default, safest) |

**Oversize** (weight > threshold) always forces `pending` regardless of toggle.

**No pricing** (not covered) always forces `pending` and creates RFQ.

### Status Flow
```
pending ──► approved  (admin clicks Approve)
pending ──► rejected  (admin clicks Reject)
pending ──► ready_to_send (toggle = auto_send, route covered, not oversize)
```

---

## 7. Dashboard UI Features

### Quotes List (`/quotes`)
Each card shows:
- Quote ID, Status badge
- **Coverage badge:** `Internal` (blue) or `RFQ` (orange)
- Language, Channel badges
- Customer name
- Origin → Destination with postal codes
- Weight
- Price (or "Pending")

### Quote Detail (`/quotes/[id]`)
Shows:
- All quote fields
- **Customer contact** (phone/email/chat ID)
- **Cargo type** panel
- **Original message** (monospace block)
- **Review reason** (warning box)
- **Response text** (info box)
- Coverage badge: `Internal Pricing` or `RFQ`

### Filters
- Status: pending / approved / rejected / ready_to_send
- Channel: whatsapp / telegram / email / web
- Language: tr / en / ar
- Search: customer name, region, currency

---

## 8. Admin Approve / Reject Flow

### Admin Clicks Approve
`POST /api/v1/quotes/[id]/approve`

1. Validates quote is `pending`
2. If no `response_text` provided:
   - **Auto-generates** response via OpenAI (`generateCustomerResponse` with status = `approved`)
   - Includes final price, origin, destination in customer's language
3. Updates quote status → `approved`
4. **Sends response to customer** via their original channel (WhatsApp/Telegram/Email)
5. Logs event in `system_logs`

### Admin Clicks Reject
`POST /api/v1/quotes/[id]/reject`

1. Validates quote is `pending`
2. If no `response_text` provided:
   - **Auto-generates** polite rejection via OpenAI (status = `rejected`)
   - Includes reason in customer's language
3. Updates quote status → `rejected`
4. **Sends response to customer** via their original channel
5. Logs event

---

## 9. Multi-Quote Detection

If a customer sends one message with multiple routes:

> *"2 separated quotes for Le Havre→Poti (12 tons) AND Le Havre→Ashgabat (15 tons)"*

The system:
1. Parses into **2 routes** via OpenAI
2. Creates **1 shipment_request** with the raw message
3. Creates **2 separate quotes** (quote #100 for Poti, quote #101 for Ashgabat)
4. Each quote independently:
   - Checks if route is covered
   - Gets its own price or RFQ
   - Has its own status

Both quotes link to the same shipment request, so clicking into either shows the **same original message**.

---

## 10. Environment Variables

```bash
# Database
DATABASE_URL=mysql://root:password@localhost:3306/logistics_dashboard

# Session / Auth
SESSION_SECRET=your-256-bit-secret
AUTH_TOKEN_SECRET=test
AUTH_TOKEN=webhook-secret-2024

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Telegram Bot
TELEGRAM_BOT_TOKEN=8566581202:AAFjnW2dC3V_6lgsc2R8YDtlg0cEeRMqBJM

# WhatsApp via n8n Webhook
# n8n connects to WhatsApp (Meta API or third-party) and forwards messages here.
# This app sends WhatsApp messages by calling the n8n webhook.
# n8n receives incoming WhatsApp messages and POSTs them to /api/webhooks/whatsapp
N8N_WHATSAPP_WEBHOOK_URL=https://your-n8n-instance.com/webhook/send-whatsapp

# Email / Outlook SMTP
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-app-password

# App URL
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app
```

---

## 11. Webhook Setup

### Telegram
```bash
# Set webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://yourdomain.com/api/webhooks/telegram"}'

# Verify
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### WhatsApp (via n8n)
1. In n8n, create a workflow that connects to WhatsApp (Meta API, WhatsApp Business API, or third-party)
2. n8n receives incoming WhatsApp messages → forwards them to:
   `POST https://yourdomain.com/api/webhooks/whatsapp`
3. This app sends WhatsApp messages by calling:
   `POST {N8N_WHATSAPP_WEBHOOK_URL}`
4. Configure `N8N_WHATSAPP_WEBHOOK_URL` in `.env.local`

### Email
Configure your email provider (SendGrid, Postmark, AWS SES) to POST parsed emails to:
```
POST https://yourdomain.com/api/webhooks/email
```

### Vendor Replies
Configure your WhatsApp/Email provider to forward vendor replies to:
```
POST https://yourdomain.com/api/webhooks/vendor-reply
Body: { "contact_id": "...", "reply_text": "..." }
```

---

## 12. API Endpoints Reference

### Incoming Messages
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/telegram` | POST | Telegram bot messages |
| `/api/webhooks/whatsapp` | POST | WhatsApp incoming messages |
| `/api/webhooks/whatsapp` | GET | Meta webhook verification |
| `/api/webhooks/email` | POST | Email parse webhook |
| `/api/webhooks/vendor-reply` | POST | Vendor price replies |

### Quotes
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/quote` | POST | Direct API ingress (auth token required) |
| `/api/v1/quotes` | GET | List quotes (paginated, filtered) |
| `/api/v1/quotes` | DELETE | Bulk delete |
| `/api/v1/quotes/[id]` | GET | Quote detail |
| `/api/v1/quotes/[id]/approve` | POST | Approve quote |
| `/api/v1/quotes/[id]/reject` | POST | Reject quote |

### RFQs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/rfqs` | GET | List RFQs |
| `/api/v1/rfqs/[id]` | GET | RFQ detail |
| `/api/v1/rfqs/[id]/generate-quote` | POST | Generate quote from vendor responses |
| `/api/v1/rfqs/process-timeouts` | GET | Cron: auto-close expired RFQs |

### Master Data
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/master-data?resource=settings` | GET | Get system settings |
| `/api/v1/master-data?resource=settings` | PUT | Update system settings |
| `/api/v1/master-data?resource=vendors` | GET/POST/PUT/DELETE | Vendor CRUD |
| `/api/v1/master-data?resource=pricing` | GET/POST/PUT/DELETE | Route pricing CRUD |
| `/api/v1/master-data?resource=rates` | GET/POST/PUT/DELETE | Exchange rates CRUD |

### Analytics
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/analytics` | GET | Dashboard summary stats |
| `/api/v1/history` | GET | Audit log |

---

## 13. Testing Scenarios

### Scenario A: Internal Pricing (Route Covered)
**Message:**
```
Quote from Germany postal code 10 to Slovenia postal code 10, 12000 kg
```
**Result:**
- Origin: `10` → `DE-North`
- Destination: `10` → `SI-West`
- Route `DE-North` → `SI-West` exists in DB
- Price: TRY 1,500 + 15% markup = TRY 1,725
- Status depends on toggle (`manual_approval` → `pending`)
- Badge: `Internal`

### Scenario B: RFQ Triggered (Route Not Covered)
**Message:**
```
Quote from Istanbul 34000 to Zagreb 10000, 15000 kg general cargo
```
**Result:**
- Origin: `34000` → not in postal_codes → "Istanbul"
- Destination: `10000` → `HR-North`
- Route `Istanbul` → `HR-North` NOT in DB
- `found: false`
- Review reason: "No internal route pricing available. RFQ initiated."
- RFQ created, vendors covering HR contacted
- Badge: `RFQ`

### Scenario C: Multi-Quote Message
**Message:**
```
2 quotes: 1) Paris 75000 to Ljubljana 1000, 8000kg  2) Berlin 10 to Vienna 10, 10000kg
```
**Result:**
- Parsed into 2 routes
- 2 quotes created from 1 shipment request
- Quote #1: Paris → Ljubljana → likely RFQ (not covered)
- Quote #2: Berlin → Vienna → check coverage
- Dashboard shows both quotes with same original message

### Scenario D: Oversize Load
**Message:**
```
Quote from DE 10 to SI 10, weight 25000 kg
```
**Result:**
- Weight: 25,000 kg > 22,000 kg threshold
- `is_oversize = true`
- Status: `pending` (always, regardless of toggle)
- Review reason: "Oversize Load: weight exceeds 22 tons"

---

## 14. Troubleshooting

### Telegram webhook returns 400
- Non-text messages (photos, stickers) are now silently ignored with 200 OK
- If you see repeated 400s: check that your app is running and ngrok URL matches

### Settings don't persist after refresh
- Fixed: GET and UPDATE now both use `ORDER BY id DESC LIMIT 1`
- If you had duplicate rows: only keep the latest one

### Postal codes show as "—"
- Means OpenAI didn't find a postal code in the message
- The parser falls back to city/country names
- Route matching will likely fail → RFQ triggered

### Vendors not receiving messages
- Check `.env.local` has correct credentials:
  - WhatsApp: `N8N_WHATSAPP_WEBHOOK_URL` must be set (n8n handles the WhatsApp connection)
  - Email: `N8N_EMAIL_WEBHOOK_URL` (preferred) or `SMTP_USER` + `SMTP_PASS`
  - Telegram: `TELEGRAM_BOT_TOKEN`
- Check `system_logs` table for `vendor_rfq_send_failed` events

### Quote shows `Internal` but I expected `RFQ`
- Check `quotes.rfq_id` — if NULL, the route WAS found in `route_pricing`
- Check `quotes.review_reason` for explanation
- Check if toggle was `auto_send` at creation time (`toggle_state_at_creation`)

---

## 15. File Map

| File | Purpose |
|------|---------|
| `lib/openai.ts` | GPT-4o parsing, customer/vendor message generation |
| `lib/automation-engine.ts` | Core flow: parse → price/RFQ → create records |
| `lib/pricing.ts` | Route pricing lookup |
| `lib/geo.ts` | Postal code → region/country resolution |
| `lib/vendor-selector.ts` | Vendor matching by country coverage |
| `lib/sender.ts` | WhatsApp via n8n webhook + Email via n8n/SMTP + Telegram Bot API |
| `lib/db-queries.ts` | Database query helpers |
| `lib/audit.ts` | Event logging |
| `app/api/webhooks/telegram/route.ts` | Telegram bot webhook |
| `app/api/webhooks/whatsapp/route.ts` | WhatsApp webhook |
| `app/api/webhooks/email/route.ts` | Email webhook |
| `app/api/webhooks/vendor-reply/route.ts` | Vendor reply webhook |
| `app/api/v1/quote/route.ts` | Direct API ingress |
| `app/api/v1/quotes/[id]/approve/route.ts` | Approve + send to customer |
| `app/api/v1/quotes/[id]/reject/route.ts` | Reject + send to customer |
| `app/api/v1/rfqs/process-timeouts/route.ts` | Cron: auto-close RFQs |
| `app/api/v1/master-data/route.ts` | Settings/vendors/pricing/rates CRUD |

---

*End of documentation*
