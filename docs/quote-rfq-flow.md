# Quote vs. RFQ — Flow & Lifecycle (n8n-Controlled)

> This document describes the **refactored** flow where n8n controls all pricing, RFQ, and vendor-selection decisions. The backend API is now a thin data layer.

---

## 1. What is a Quote?

A **Quote** is a price offer generated for a customer's shipment request. It is the central entity that n8n (or the admin) reviews, updates, approves, rejects, or dispatches.

| Field | Description |
|-------|-------------|
| `id` | Auto-increment primary key |
| `shipment_request_id` | Links to the raw incoming request |
| `origin_region` / `destination_region` | Resolved from postal codes |
| `base_price` | Price before margin |
| `markup_percent` | Admin/vendor margin applied |
| `final_price` | `base_price × (1 + markup/100)` |
| `currency` | Usually `TRY` |
| `status` | `pending` → `approved` / `rejected` / `ready_to_send` |
| `handling_mode` | `auto` / `manual` / `external` — set by n8n on creation |
| `rfq_id` | Links to RFQ if one was created by n8n |
| `is_oversize` | True if weight > 22 tons (set by n8n, not auto) |
| `review_reason` | Why it requires manual review |

### Quote States

```
[new message]
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   pending   │────▶│  approved   │     │   rejected  │
└─────────────┘     └─────────────┘     └─────────────┘
    │
    └────────────────▶┌─────────────┐
                      │ready_to_send│
                      └─────────────┘
```

| Status | Meaning |
|--------|---------|
| `pending` | Needs action (n8n or admin will process) |
| `ready_to_send` | Price is set and the quote can be sent to the customer |
| `approved` | Admin approved the quote (may have revised price) |
| `rejected` | Admin rejected the quote (reason recorded) |

---

## 2. What is an RFQ?

An **RFQ** (Request for Quote) is created **by n8n** when it decides that internal pricing is not available. The RFQ tracks vendor outreach and responses.

| Field | Description |
|-------|-------------|
| `id` | Auto-increment primary key |
| `quote_id` | Links to the parent Quote |
| `rfq_reference` | Unique external identifier (e.g. `RFQ-2026-0001`) |
| `target_country` | Destination country code |
| `status` | `open` → `responded` → `closed` |

### RFQ Vendor Assignments

Each vendor linked to an RFQ is stored in `rfq_vendor_assignments`:

| Field | Description |
|-------|-------------|
| `vendor_id` | Reference to vendors table |
| `contact_channel` | `email` or `whatsapp` |
| `contact_id` | WhatsApp ID or email address (used by n8n to match replies) |
| `response_price` | Price received from vendor |
| `response_currency` | Currency of vendor response |
| `status` | `pending` or `responded` |

### RFQ States

```
[n8n creates RFQ]
    │
    ▼
┌─────────┐     ┌───────────┐     ┌─────────┐
│  open   │────▶│ responded │────▶│ closed  │
└─────────┘     └───────────┘     └─────────┘
```

| Status | Meaning |
|--------|---------|
| `open` | n8n has assigned vendors and sent messages |
| `responded` | n8n recorded vendor price responses |
| `closed` | n8n selected a vendor and generated the final quote |

---

## 3. Key Differences

| | **Quote** | **RFQ** |
|---|---|---|
| **Purpose** | Price offer for the customer | Vendor price collection when internal pricing is missing |
| **Created when** | On every incoming shipment message | **Only when n8n decides to create one** |
| **Parent/Child** | Parent entity (standalone) | Child entity — always linked to a Quote via `quote_id` |
| **Who resolves it** | n8n or admin | n8n controls vendor outreach and response collection |
| **Final output** | Sent to customer | Feeds a price back into the linked Quote |
| **Status values** | `pending`, `ready_to_send`, `approved`, `rejected` | `open`, `responded`, `closed` |

---

## 4. When is Each Created?

### Incoming Message
- **Quote** created by API with `status = 'pending'` and `handling_mode` from request
- **NO pricing lookup, NO oversize check, NO toggle evaluation, NO auto-RFQ**

### n8n Decision Flow
```
Quote created (pending)
    │
    ▼
n8n evaluates:
    │
    ├── Can price internally? ──▶ PUT /api/v1/quotes/{id}
    │                                Update price fields
    │                                status = 'ready_to_send'
    │
    └── Cannot price? ──▶ POST /api/v1/rfqs
                             Create RFQ with vendors
                             Link quote via rfq_id
```

---

## 5. Full Flow — New Message Received

### Step 1: Incoming Request
```
WhatsApp / Telegram / Email / n8n
         │
         ▼
POST /api/v1/quote
Authorization: Bearer <token>
Body: {
  origin_postal_code,
  destination_postal_code,
  weight_kg,
  language,
  channel,
  handling_mode        // "auto" | "manual" | "external"
}
```

### Step 2: Authentication & Validation
- Bearer token verified
- Body validated with `shipmentRequestSchema` (Zod)

### Step 3: Geo Resolution
- Origin postal code → `origin_region`
- Destination postal code → `destination_region`

### Step 4: Persist Raw Request
```
INSERT INTO shipment_requests (..., raw_payload)
```

### Step 5: Create Quote (Thin Layer)
```
INSERT INTO quotes (..., status='pending', handling_mode=?, ...)
```

### Step 6: Response to Caller
```json
{
  "quote_id": 123,
  "status": "pending",
  "handling_mode": "auto",
  "origin_region": "İstanbul Anadolu",
  "destination_region": "PL 3-4-5 Bölge",
  "base_price": null,
  "markup_percent": null,
  "final_price": null,
  "currency": "TRY",
  "message": "Request received and quote created"
}
```

### Step 7: n8n Processing

#### A. Internal Pricing Found
```
PUT /api/v1/quotes/{quote_id}
Body: {
  base_price: 15000,
  markup_percent: 10,
  final_price: 16500,
  currency: "TRY",
  status: "ready_to_send"
}
```

#### B. External Pricing Needed (RFQ)
```
POST /api/v1/rfqs
Body: {
  quote_id: 123,
  rfq_reference: "RFQ-2026-0001",
  target_country: "PL",
  vendors: [
    { vendor_id: 10, contact_channel: "whatsapp", contact_id: "201234567890" },
    { vendor_id: 12, contact_channel: "whatsapp", contact_id: "201111111111" }
  ]
}
```

This creates:
- `rfq_records` row with `status = 'open'`
- `rfq_vendor_assignments` rows with `status = 'pending'`
- Updates `quotes.rfq_id`

### Step 8: Vendor Replies
- n8n listener captures WhatsApp replies using `contact_id`
- Matches reply to `rfq_vendor_assignments` via `contact_id`

### Step 9: Record Vendor Response
```
POST /api/v1/rfqs/{rfq_id}
Body: {
  vendor_responses: [
    { vendor_id: 10, price: 1650, currency: "TRY" }
  ]
}
```

This updates:
- `rfq_vendor_assignments` with `response_price`, `response_currency`, `status = 'responded'`
- `rfq_records.status = 'responded'`

### Step 10: Generate Final Quote from RFQ
```
POST /api/v1/rfqs/{rfq_id}/generate-quote
Body: {
  selected_vendor_id: 10,
  admin_margin_percent: 5
}
```

This:
- Reads vendor price from `rfq_vendor_assignments`
- Converts to TRY if needed
- Applies margin
- Updates linked Quote → `status = 'ready_to_send'`
- Updates RFQ → `status = 'closed'`

---

## 6. State Transition Summary

### Quote
| From | To | Trigger |
|------|----|---------|
| *(new)* | `pending` | Incoming message received |
| `pending` | `ready_to_send` | n8n sets internal pricing OR generates from RFQ |
| `pending` | `approved` | Admin approves via dashboard |
| `pending` | `rejected` | Admin rejects via dashboard |

### RFQ
| From | To | Trigger |
|------|----|---------|
| *(new)* | `open` | n8n creates RFQ via API |
| `open` | `responded` | n8n records vendor responses |
| `responded` | `closed` | n8n selects vendor and generates quote |

---

## 7. Entity Relationship

```
┌─────────────────────┐         ┌─────────────────────┐
│  shipment_requests  │         │   route_pricing     │
│  (raw incoming msg) │         │  (internal prices)  │
└──────────┬──────────┘         └─────────────────────┘
           │
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│       quotes        │◀────────│    rfq_records      │
│  (customer offer)   │   1:1   │  (vendor pricing)   │
└─────────────────────┘         └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│      vendors        │
│  (master data)      │
└─────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  rfq_vendor_assignments     │
│  (per-RFQ vendor contacts)  │
└─────────────────────────────┘
```

---

## 8. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/quote` | `POST` | Main ingress — creates Quote ONLY (no pricing, no RFQ) |
| `/api/v1/quotes/{id}` | `PUT` | n8n updates quote prices/status |
| `/api/v1/quotes/{id}/approve` | `POST` | Admin approves a pending quote |
| `/api/v1/quotes/{id}/reject` | `POST` | Admin rejects a pending quote |
| `/api/v1/rfqs` | `POST` | n8n creates an RFQ with vendor assignments |
| `/api/v1/rfqs` | `GET` | List all RFQs (dashboard) |
| `/api/v1/rfqs/{id}` | `GET` | View RFQ details with vendor assignments |
| `/api/v1/rfqs/{id}` | `POST` | Record vendor responses |
| `/api/v1/rfqs/{id}/generate-quote` | `POST` | Convert RFQ responses into a ready quote |

---

## 9. Handling Modes

| Mode | Meaning |
|------|---------|
| `auto` | n8n will handle automatically (may trigger pricing lookup and dispatch) |
| `manual` | Waiting for human/admin action |
| `external` | Fully controlled by n8n (backend takes no automatic actions) |

---

*Last updated: 2026-05-02 (refactored for n8n control)*
