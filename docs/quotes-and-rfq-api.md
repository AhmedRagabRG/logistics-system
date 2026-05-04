# Quotes & RFQ System — API Guide

> **Version:** 1.0  
> **Base URL:** `https://your-domain.com`  
> **Tech:** Next.js 16 App Router, MySQL, Zod validation

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Master Logic Toggle](#master-logic-toggle)
3. [Quote Lifecycle](#quote-lifecycle)
4. [RFQ Lifecycle](#rfq-lifecycle)
5. [Authentication](#authentication)
6. [API Reference](#api-reference)
   - [Ingress — Create Quote (n8n / External)](#1-post-apiv1quote)
   - [List Quotes](#2-get-apiv1quotes)
   - [Update Quote](#3-put-apiv1quotesid)
   - [Approve Quote](#4-post-apiv1quotesidapprove)
   - [Reject Quote](#5-post-apiv1quotesidreject)
   - [Bulk Delete Quotes](#6-delete-apiv1quotes)
   - [List RFQs](#7-get-apiv1rfqs)
   - [Get RFQ Detail](#8-get-apiv1rfqsid)
   - [Record Vendor Responses](#9-post-apiv1rfqsid)
   - [Generate Quote from RFQ](#10-post-apiv1rfqsidgenerate-quote)
   - [Bulk Delete RFQs](#11-delete-apiv1rfqs)
7. [Error Codes](#error-codes)
8. [n8n Webhook Example](#n8n-webhook-example)

---

## Architecture Overview

```
┌─────────────────┐     POST /api/v1/quote      ┌──────────────────┐
│  n8n / WhatsApp │ ───────────────────────────>│  Shipment Request│
│  / Telegram     │   (Bearer auth token)       │  (MySQL)         │
└─────────────────┘                             └────────┬─────────┘
                                                         │
                              ┌────────────────────────┐
                              │ 1. Resolve postal codes │
                              │ 2. Check oversize (22t) │
                              │ 3. Lookup route pricing │
                              │ 4. Check master toggle  │
                              └────────────────────────┘
                                                         │
                              ┌────────────────────────┴────────────────────────┐
                              ▼                                                 ▼
                    ┌─────────────────┐                              ┌─────────────────┐
                    │  Internal Price │                              │  No Route Price │
                    │  Found          │                              │  Found          │
                    └────────┬────────┘                              └────────┬────────┘
                             │                                               │
                             ▼                                               ▼
                    ┌─────────────────┐                              ┌─────────────────┐
                    │  Quote Created  │                              │  RFQ Created    │
                    │  (ready/pending)│                              │  (open)         │
                    └─────────────────┘                              └────────┬────────┘
                                                                              │
                                                                              ▼
                                                                    ┌─────────────────┐
                                                                    │ Vendor Responses│
                                                                    │ (responded)     │
                                                                    └────────┬────────┘
                                                                             │
                                                                             ▼
                                                                    ┌─────────────────┐
                                                                    │ Generate Quote  │
                                                                    │ (ready_to_send) │
                                                                    └─────────────────┘
```

### Data Model

| Table | Purpose |
|---|---|
| `shipment_requests` | Raw inbound request from customer (postal codes, weight, channel, language, payload) |
| `quotes` | Pricing output — base price, markup, final price, currency, status, review reason |
| `rfq_records` | Vendor failover tracker — selected vendors, their responses, generated quote price |
| `vendors` | Vendor master data — country coverage, expertise, priority ranking, margin rate |
| `route_pricing` | Internal route price matrix — origin/destination region → base price + markup |
| `system_settings` | Master logic toggle + defaults |

---

## Master Logic Toggle

Stored in `system_settings.master_logic_toggle`. Determines how new quotes are handled.

| Mode | Behavior |
|---|---|
| **`auto_send`** | Quote auto-approved → `ready_to_send`. Admin can still review in dashboard. |
| **`low_confidence_only`** | All quotes start as `pending` (low confidence proxy). Admin must approve/reject. |
| **`manual_approval`** | All quotes start as `pending`. Admin must approve/reject. |

> **Cache:** 30-second in-memory cache. Change in **Master Data → Settings** reflects within 30s.

### Override Rules (always take precedence over toggle)

- **Oversize (>22 tons):** Always `pending` with review reason *"Oversize Load: weight exceeds 22 tons"*
- **No internal route pricing:** Always `pending` + auto-create RFQ to top 3 vendors

---

## Quote Lifecycle

```
pending → approved → (dispatched to customer)
pending → rejected
pending → ready_to_send → (dispatched to customer)
```

| Status | Meaning |
|---|---|
| `pending` | Awaiting admin action or blocked by toggle/oversize/missing pricing |
| `ready_to_send` | Approved by toggle or admin — ready for customer dispatch |
| `approved` | Manually approved by admin (possibly with revised price) |
| `rejected` | Manually rejected by admin (with reason) |

### Fields

| Field | Type | Notes |
|---|---|---|
| `base_price` | number | Internal route price or vendor price (normalized to TRY) |
| `markup_percent` | number | Admin margin or route pricing markup |
| `final_price` | number | `base_price * (1 + markup_percent/100)` |
| `currency` | string(3) | Always TRY for customer-facing quotes |
| `toggle_state_at_creation` | enum | Snapshot of toggle when quote was created |
| `is_oversize` | boolean | `true` if weight > 22 tons |
| `review_reason` | string | Why it's pending (oversize, manual mode, no pricing, etc.) |
| `response_text` | string | Message sent back to customer (set on approve/reject) |
| `approved_by` | int | Admin user ID who acted |
| `approved_at` | datetime | When admin acted |

---

## RFQ Lifecycle

```
open → responded → closed
```

| Status | Meaning |
|---|---|
| `open` | Vendors contacted, awaiting responses |
| `responded` | At least one vendor responded |
| `closed` | Admin generated final quote from selected vendor response |

### Fields

| Field | Type | Notes |
|---|---|---|
| `quote_id` | int | Links back to quotes table |
| `target_country` | string | Destination country ISO code |
| `selected_vendors` | JSON | Array of vendor IDs `[1, 2, 3]` |
| `vendor_responses` | JSON | Array of `{ vendor_id, price, currency }` |
| `generated_quote_price` | number | Final price after margin applied (set on close) |

---

## Authentication

The system uses **two different auth mechanisms**:

### 1. Ingress API (`/api/v1/quote`)
Used by n8n, WhatsApp bots, external systems.

```
Authorization: Bearer <AUTH_TOKEN>
```

Token is verified against `system_settings.auth_token` (plain text shared secret).

### 2. Dashboard APIs (everything else)
Used by the admin dashboard.

```
Cookie: session=<signed-jwt>
```

- HTTP-only cookie set on login
- Verified server-side against MySQL session store
- All dashboard APIs use `requireAdminSession()`

---

## API Reference

### 1. POST `/api/v1/quote`

**Ingress endpoint** — create a shipment request + quote from external system (n8n, WhatsApp, etc.)

**Auth:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "origin_postal_code": "34",
  "destination_postal_code": "10",
  "weight_kg": 12500,
  "cargo_type": "General Cargo",
  "customer_name": "Ahmet Yilmaz",
  "language": "tr",
  "channel": "whatsapp"
}
```

**Validation Rules:**
- `origin_postal_code`: required, max 20 chars
- `destination_postal_code`: required, max 20 chars
- `weight_kg`: required, positive number
- `language`: enum `ar` | `tr` | `en`
- `channel`: enum `whatsapp` | `telegram` | `email`
- `cargo_type`: optional, max 64 chars
- `customer_name`: optional, max 128 chars

**Responses:**

**Case A — Auto-send (normal, toggle = auto_send)**
```json
{
  "success": true,
  "data": {
    "quote_id": 42,
    "status": "ready_to_send",
    "origin_region": "Istanbul",
    "destination_region": "SI-West",
    "base_price": 1500,
    "markup_percent": 15,
    "final_price": 1725,
    "currency": "TRY",
    "is_oversize": false,
    "message": "Teklif gönderilmeye hazır"
  }
}
```

**Case B — Manual approval (toggle = manual_approval)**
```json
{
  "success": true,
  "data": {
    "quote_id": 43,
    "status": "pending",
    "origin_region": "Istanbul",
    "destination_region": "SI-West",
    "base_price": 1500,
    "markup_percent": 15,
    "final_price": 1725,
    "currency": "TRY",
    "is_oversize": false,
    "review_reason": "Manual Approval mode is active",
    "message": "Teklif manuel inceleme gerektiriyor"
  }
}
```

**Case C — Oversize (>22t)**
```json
{
  "success": true,
  "data": {
    "quote_id": 44,
    "status": "pending",
    "origin_region": "Istanbul",
    "destination_region": "SI-West",
    "base_price": null,
    "markup_percent": null,
    "final_price": null,
    "currency": "TRY",
    "is_oversize": true,
    "review_reason": "Oversize Load: weight exceeds 22 tons",
    "message": "Gönderi maksimum ağırlığı (22 ton) aşıyor ve manuel inceleme gerektiriyor"
  }
}
```

**Case D — No internal pricing (RFQ auto-created)**
```json
{
  "success": true,
  "data": {
    "quote_id": 45,
    "status": "pending",
    "origin_region": "UNKNOWN",
    "destination_region": "UNKNOWN",
    "base_price": null,
    "markup_percent": null,
    "final_price": null,
    "currency": "TRY",
    "is_oversize": false,
    "review_reason": "No internal route pricing available. RFQ initiated.",
    "rfq": {
      "target_country": "DE",
      "selected_vendors": [{ "id": 1, "name": "Vendor A" }, { "id": 2, "name": "Vendor B" }]
    },
    "message": "Dahili fiyatlandırma mevcut değil. Tedarikçilere RFQ gönderildi."
  }
}
```

**cURL:**
```bash
curl -X POST https://your-domain.com/api/v1/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "origin_postal_code": "34",
    "destination_postal_code": "10",
    "weight_kg": 12500,
    "cargo_type": "General Cargo",
    "customer_name": "Ahmet Yilmaz",
    "language": "tr",
    "channel": "whatsapp"
  }'
```

---

### 2. GET `/api/v1/quotes`

List all quotes with pagination, search, and filters.

**Auth:** Admin session cookie

**Query Params:**

| Param | Type | Description |
|---|---|---|
| `page` | int | Default: 1 |
| `limit` | int | Default: 20, max: 100 |
| `status` | string | Filter by status: `pending`, `approved`, `rejected`, `ready_to_send` |
| `channel` | string | Filter by channel: `whatsapp`, `telegram`, `email`, `web` |
| `language` | string | Filter by language: `ar`, `tr`, `en` |
| `from_date` | string | YYYY-MM-DD |
| `to_date` | string | YYYY-MM-DD |
| `search` | string | Searches `customer_name`, `origin_region`, `destination_region`, `currency` |

**Response:**
```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "id": 1,
        "origin_region": "Istanbul",
        "destination_region": "SI-West",
        "final_price": 1725,
        "currency": "TRY",
        "status": "pending",
        "is_oversize": false,
        "created_at": "2026-04-29T10:00:00.000Z",
        "origin_postal_code": "34",
        "destination_postal_code": "10",
        "weight_kg": 12500,
        "channel": "whatsapp",
        "language": "tr",
        "customer_name": "Ahmet Yilmaz"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42
    }
  }
}
```

**cURL:**
```bash
curl "https://your-domain.com/api/v1/quotes?page=1&limit=20&status=pending&search=Istanbul" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

---

### 3. PUT `/api/v1/quotes/:id`

Edit quote pricing fields before approval.

**Auth:** Admin session cookie

**Body:**
```json
{
  "base_price": 1600,
  "markup_percent": 20,
  "final_price": 1920,
  "currency": "TRY",
  "review_reason": "Adjusted for fuel surcharge"
}
```

All fields are optional. At least one field required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "updated": true
  }
}
```

**cURL:**
```bash
curl -X PUT https://your-domain.com/api/v1/quotes/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "base_price": 1600,
    "final_price": 1920,
    "currency": "TRY"
  }'
```

---

### 4. POST `/api/v1/quotes/:id/approve`

Approve a pending quote. Optionally revise the price and add admin notes.

**Auth:** Admin session cookie

**Body:**
```json
{
  "revised_price": 1800,
  "notes": "Customer accepted after negotiation",
  "response_text": "Your quote of 1800 TRY has been approved. We will dispatch within 24 hours."
}
```

| Field | Required | Description |
|---|---|---|
| `revised_price` | No | Override final_price. Uses existing final_price if omitted. |
| `notes` | No | Internal review notes |
| `response_text` | No | Message sent back to customer |

**Response:**
```json
{
  "success": true,
  "data": {
    "quote_id": 1,
    "status": "approved",
    "final_price": 1800,
    "approved_at": "2026-04-29T14:30:00.000Z"
  }
}
```

**cURL:**
```bash
curl -X POST https://your-domain.com/api/v1/quotes/1/approve \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "revised_price": 1800,
    "notes": "Approved with discount",
    "response_text": "Your quote has been approved!"
  }'
```

---

### 5. POST `/api/v1/quotes/:id/reject`

Reject a pending quote.

**Auth:** Admin session cookie

**Body:**
```json
{
  "reason": "Route not available for this tonnage",
  "response_text": "Sorry, we cannot service this route at the moment."
}
```

| Field | Required | Description |
|---|---|---|
| `reason` | **Yes** | Rejection reason (max 500 chars) |
| `response_text` | No | Message sent back to customer |

**Response:**
```json
{
  "success": true,
  "data": {
    "quote_id": 1,
    "status": "rejected",
    "rejection_reason": "Route not available for this tonnage",
    "rejected_at": "2026-04-29T14:30:00.000Z"
  }
}
```

**cURL:**
```bash
curl -X POST https://your-domain.com/api/v1/quotes/1/reject \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "reason": "Route not available",
    "response_text": "We apologize, this route is temporarily unavailable."
  }'
```

---

### 6. DELETE `/api/v1/quotes?ids=1,2,3`

Bulk delete quotes (and their linked RFQs).

**Auth:** Admin session cookie

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": 3
  }
}
```

**cURL:**
```bash
curl -X DELETE "https://your-domain.com/api/v1/quotes?ids=1,2,3" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

---

### 7. GET `/api/v1/rfqs`

List all RFQs with pagination and filters.

**Auth:** Admin session cookie

**Query Params:**

| Param | Type | Description |
|---|---|---|
| `page` | int | Default: 1 |
| `limit` | int | Default: 20, max: 100 |
| `status` | string | `open`, `responded`, `closed` |
| `search` | string | Searches `origin_region`, `destination_region`, `target_country` |

**Response:**
```json
{
  "success": true,
  "data": {
    "rfqs": [
      {
        "id": 1,
        "quote_id": 5,
        "target_country": "SI",
        "status": "responded",
        "origin_region": "Bursa",
        "destination_region": "SI-West",
        "selected_vendors": [
          { "id": 1, "name": "Vendor A" },
          { "id": 2, "name": "Vendor B" }
        ],
        "vendor_responses": [
          { "vendor_id": 1, "price": 1650, "currency": "TRY" },
          { "vendor_id": 2, "price": 1680, "currency": "TRY" }
        ],
        "created_at": "2026-04-29T10:00:00.000Z",
        "updated_at": "2026-04-29T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 4
    }
  }
}
```

**cURL:**
```bash
curl "https://your-domain.com/api/v1/rfqs?page=1&status=open" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

---

### 8. GET `/api/v1/rfqs/:id`

Get single RFQ detail.

**Auth:** Admin session cookie

**Response:** Same shape as single item in list.

**cURL:**
```bash
curl https://your-domain.com/api/v1/rfqs/1 \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

---

### 9. POST `/api/v1/rfqs/:id`

Record vendor responses for an open RFQ.

**Auth:** Admin session cookie

**Body:**
```json
{
  "vendor_responses": [
    { "vendor_id": 1, "price": 1650, "currency": "TRY" },
    { "vendor_id": 2, "price": 1680, "currency": "TRY" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rfq_id": 1,
    "status": "responded",
    "vendor_responses": [
      { "vendor_id": 1, "price": 1650, "currency": "TRY" },
      { "vendor_id": 2, "price": 1680, "currency": "TRY" }
    ]
  }
}
```

**cURL:**
```bash
curl -X POST https://your-domain.com/api/v1/rfqs/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "vendor_responses": [
      { "vendor_id": 1, "price": 1650, "currency": "TRY" },
      { "vendor_id": 2, "price": 1680, "currency": "TRY" }
    ]
  }'
```

---

### 10. POST `/api/v1/rfqs/:id/generate-quote`

Generate a final quote from vendor responses. Selects one vendor, applies margin, normalizes currency to TRY.

**Auth:** Admin session cookie

**Body:**
```json
{
  "selected_vendor_id": 1,
  "admin_margin_percent": 10
}
```

| Field | Required | Description |
|---|---|---|
| `selected_vendor_id` | **Yes** | Which vendor's price to use |
| `admin_margin_percent` | No | Additional margin on top of vendor price. Default: 0 |

**Calculation:**
```
1. Get vendor response price
2. If currency != TRY: lookup exchange rate, convert to TRY
3. final_price = vendor_price_try * (1 + admin_margin_percent / 100)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rfq_id": 1,
    "quote_id": 5,
    "vendor_price": 1650,
    "margin_percent": 10,
    "final_price": 1815,
    "currency": "TRY",
    "status": "ready_to_send"
  }
}
```

**cURL:**
```bash
curl -X POST https://your-domain.com/api/v1/rfqs/1/generate-quote \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "selected_vendor_id": 1,
    "admin_margin_percent": 10
  }'
```

---

### 11. DELETE `/api/v1/rfqs?ids=1,2`

Bulk delete RFQ records.

**Auth:** Admin session cookie

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": 2
  }
}
```

**cURL:**
```bash
curl -X DELETE "https://your-domain.com/api/v1/rfqs?ids=1,2" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid Bearer token / session cookie |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed (see `details` array) |
| `NOT_FOUND` | 404 | Quote/RFQ ID not found |
| `ALREADY_PROCESSED` | 409 | Quote already approved/rejected |
| `INVALID_STATE` | 409 | RFQ not in correct state for action |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

**Validation Error Example:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "weight_kg", "message": "Weight must be greater than 0" },
      { "field": "language", "message": "Language must be ar, tr, or en" }
    ]
  }
}
```

---

## n8n Webhook Example

Configure an n8n HTTP Request node to send incoming WhatsApp/Telegram messages to the quote engine.

### Node Settings

- **Method:** POST
- **URL:** `https://your-domain.com/api/v1/quote`
- **Authentication:** Generic Credential Type → Header Auth
  - Name: `Authorization`
  - Value: `Bearer YOUR_AUTH_TOKEN`
- **Body:** JSON

### JSON Body (using n8n expressions)

```json
{
  "origin_postal_code": "{{ $json.origin_postal_code }}",
  "destination_postal_code": "{{ $json.destination_postal_code }}",
  "weight_kg": {{ $json.weight_kg }},
  "cargo_type": "{{ $json.cargo_type }}",
  "customer_name": "{{ $json.customer_name }}",
  "language": "{{ $json.language }}",
  "channel": "{{ $json.channel }}"
}
```

### Response Handling

After the HTTP Request node, use an **IF node** to branch based on `status`:

```
{{ $json.data.status }}
```

| Condition | Action |
|---|---|
| `ready_to_send` | Send quote to customer via WhatsApp/Telegram |
| `pending` | Notify admin in dashboard (do not send to customer) |

### Example: Send approved quote back to WhatsApp

Add a **WhatsApp Business Cloud** node after IF (true branch):

```
Hello {{ $json.data.customer_name }},

Your logistics quote is ready:

Route: {{ $json.data.origin_region }} → {{ $json.data.destination_region }}
Price: {{ $json.data.final_price }} {{ $json.data.currency }}

{{ $json.data.message }}
```

### Example: Notify admin on pending/oversize

Add a **Slack** or **Email** node after IF (false branch):

```
🚨 Pending Quote Requires Review

Quote ID: {{ $json.data.quote_id }}
Reason: {{ $json.data.review_reason }}
Customer: {{ $json.data.customer_name }}
```

---

## Quick Reference Card

| Task | Method | Endpoint | Auth |
|---|---|---|---|
| Create quote (n8n) | POST | `/api/v1/quote` | Bearer |
| List quotes | GET | `/api/v1/quotes` | Cookie |
| Edit quote price | PUT | `/api/v1/quotes/:id` | Cookie |
| Approve quote | POST | `/api/v1/quotes/:id/approve` | Cookie |
| Reject quote | POST | `/api/v1/quotes/:id/reject` | Cookie |
| Delete quotes | DELETE | `/api/v1/quotes?ids=...` | Cookie |
| List RFQs | GET | `/api/v1/rfqs` | Cookie |
| Get RFQ | GET | `/api/v1/rfqs/:id` | Cookie |
| Add vendor responses | POST | `/api/v1/rfqs/:id` | Cookie |
| Generate quote from RFQ | POST | `/api/v1/rfqs/:id/generate-quote` | Cookie |
| Delete RFQs | DELETE | `/api/v1/rfqs?ids=...` | Cookie |

---

*Document generated for the Logistics Automation Platform. Keep in sync with schema changes.*
