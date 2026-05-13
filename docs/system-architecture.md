# System Architecture & Automation Guide

> Complete guide to the fully automated logistics dashboard. All automation is built-in — no n8n required.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Message Channels](#message-channels)
3. [AI-Powered Message Parsing](#ai-powered-message-parsing)
4. [Automation Flow](#automation-flow)
5. [Webhook Setup](#webhook-setup)
6. [Vendor Communication](#vendor-communication)
7. [Approval Workflow](#approval-workflow)
8. [Timeout Processing](#timeout-processing)
9. [API Reference](#api-reference)
10. [Environment Variables](#environment-variables)

---

## System Overview

The system is a fully automated logistics management dashboard that:

- Receives shipment requests via **WhatsApp**, **Telegram**, and **Email**
- Uses **OpenAI gpt-4o** to parse unstructured messages into structured data
- Determines service coverage using postal code databases
- Calculates pricing from internal route tables
- Automatically forwards uncovered routes to vendors via their preferred channels
- Waits for vendor responses (configurable waiting period)
- Selects the lowest bid, applies margin, and sends the final quote to the customer
- Provides a full admin dashboard for monitoring, approval, and management

### Architecture Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  WhatsApp   │    │  Telegram   │    │    Email    │
│   Webhook   │    │   Webhook   │    │   Webhook   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  OpenAI Parser      │
              │  (extract fields)   │
              └─────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  Automation Engine  │
              │  (business logic)   │
              └─────────────────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │  Quote   │ │   RFQ    │ │  Vendor  │
      │  Ready   │ │ Created  │ │ Messages │
      └──────────┘ └──────────┘ └──────────┘
            │             │             │
            ▼             ▼             ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │ Customer │ │  Vendor  │ │  Vendor  │
      │ Response │ │ Replies  │ │  Reply   │
      │  Sent    │ │  Wait    │ │ Webhook  │
      └──────────┘ └──────────┘ └──────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  Timeout Processor  │
              │  (auto-select bid)  │
              └─────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  Final Quote Sent   │
              │  to Customer        │
              └─────────────────────┘
```

---

## Message Channels

### Supported Channels

| Channel | Endpoint | Provider Setup |
|---------|----------|---------------|
| **WhatsApp** | `POST /api/webhooks/whatsapp` | Twilio, 360dialog, or Meta Business API |
| **Telegram** | `POST /api/webhooks/telegram` | Telegram Bot API |
| **Email** | `POST /api/webhooks/email` | SendGrid Inbound Parse, AWS SES, Postmark |

### How Messages Flow

1. Customer sends message to your WhatsApp/Telegram/Email
2. Provider forwards the message to the webhook endpoint
3. System extracts the raw text
4. OpenAI parses the message into structured data
5. Automation engine processes the request
6. System responds (or forwards to vendors if needed)

---

## AI-Powered Message Parsing

### What OpenAI Extracts

The system uses OpenAI gpt-4o to parse raw customer messages and extract:

| Field | Example |
|-------|---------|
| `customer_name` | "WEILER ABRASIVES D.O.O." |
| `origin_postal_code` | "34" (İstanbul) |
| `origin_city` | "İstanbul" |
| `origin_country` | "TR" |
| `destination_postal_code` | "10" (Germany) |
| `destination_city` | "Mülheim" |
| `destination_country` | "DE" |
| `weight_kg` | 3500 |
| `cargo_type` | "General Cargo", "Oversize" |
| `vehicle_type` | "mega", "kapalı kasa" |
| `loading_date` | "2026-05-15" |
| `language` | "tr", "ar", "en" |

### Confidence Scoring

OpenAI returns a confidence level for each parse:
- **High** — All critical fields present (origin, destination, weight)
- **Medium** — Some ambiguity, but enough to proceed
- **Low** — Missing critical information → system asks customer for missing fields

### Fallback Behavior

If OpenAI fails or API key is not configured:
- The system accepts structured JSON directly via `POST /api/v1/quote`
- Raw messages without parsing will result in a data_request response

---

## Automation Flow

### Full End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Message Received                                       │
│  - WhatsApp/Telegram/Email webhook triggers                     │
│  - Raw message text captured                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: AI Parsing (OpenAI)                                    │
│  - Extract origin, destination, weight, cargo type              │
│  - Detect language                                              │
│  - Assess confidence                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Geo Resolution                                         │
│  - Origin postal code → region                                  │
│  - Destination postal code → region + country                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Coverage Check                                         │
│  - Do we have postal code coverage?                             │
│  - Do we have route pricing for this origin/destination?        │
└────────────────────────────┬────────────────────────────────────┘
                             │
           ┌─────────────────┴─────────────────┐
           │                                   │
           ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│  PRICING FOUND      │             │  NO PRICING         │
│  - Calculate price  │             │  - Create RFQ       │
│  - Apply margin     │             │  - Find vendors     │
│  - Ready to send    │             │  - Send messages    │
└──────────┬──────────┘             └──────────┬──────────┘
           │                                   │
           ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│  Toggle Evaluation  │             │  Vendor Response    │
│  - auto_send → ready│             │  - Wait period      │
│  - manual → pending │             │  - Vendors reply    │
│  - low_conf → check │             │  - Pick lowest bid  │
└──────────┬──────────┘             └──────────┬──────────┘
           │                                   │
           └─────────────────┬─────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Customer Response                                      │
│  - AI generates professional response in customer's language    │
│  - Includes price, route details, and next steps                │
└─────────────────────────────────────────────────────────────────┘
```

### Branching Logic

```
Is critical data missing?
    │
    ├── YES ──▶ Ask customer for missing fields (data_request)
    │
    └── NO ──▶  Is weight > threshold?
                     │
                     ├── YES ──▶ Quote pending (oversize review)
                     │
                     └── NO ──▶  Route pricing exists?
                                      │
                                      ├── YES ──▶ Calculate price
                                      │              │
                                      │              ├── auto_send ──▶ ready_to_send
                                      │              ├── manual ─────▶ pending
                                      │              └── low_conf ──▶ check confidence
                                      │
                                      └── NO ──▶  Create RFQ
                                                     Send to vendors
                                                     Wait for responses
```

---

## Webhook Setup

### WhatsApp (Twilio Example)

1. Sign up at [Twilio](https://www.twilio.com/)
2. Get a WhatsApp-enabled number
3. Configure webhook URL:
   ```
   POST https://yourdomain.com/api/webhooks/whatsapp
   ```
4. Set auth token in `.env.local`:
   ```
   AUTH_TOKEN=your-twilio-auth-token
   ```

### WhatsApp (via n8n)

1. In n8n, create a workflow that connects to WhatsApp (Meta API, WhatsApp Business API, or third-party)
2. n8n receives incoming WhatsApp messages → forwards them to:
   `POST https://yourdomain.com/api/webhooks/whatsapp`
3. This app sends WhatsApp messages by calling:
   `POST {N8N_WHATSAPP_WEBHOOK_URL}`
4. Set in `.env.local`:
   ```
   N8N_WHATSAPP_WEBHOOK_URL=https://your-n8n-instance.com/webhook/send-whatsapp
   ```

### Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot and get token
3. Set webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://yourdomain.com/api/webhooks/telegram"}'
   ```

### Email (SendGrid Inbound Parse)

1. Go to SendGrid Dashboard → Inbound Parse
2. Add host and URL:
   ```
   Webhook URL: https://yourdomain.com/api/webhooks/email
   ```
3. Configure MX records for your domain

---

## Vendor Communication

### How Vendors Are Selected

1. System looks up destination country from postal code
2. Queries `vendors` table for active vendors whose `country_coverage` matches
3. Respects vendor `priority_ranking` (lower = higher priority)
4. Sends to **all active vendors** (not limited to 3)

### Preferred Channels

Each vendor can have preferred channels set in the dashboard:
- **Email only**
- **WhatsApp only**
- **Email + WhatsApp**

System creates a vendor assignment for each selected channel.

### Vendor Message Format

```
RFQ Reference: RFQ-20260102-001

Dear Vendor,

We have a new quote request:
- Origin: İstanbul Anadolu → DE-North
- Weight: 3,500 kg
- Cargo: General Cargo

Please reply with your price in TRY.
Include reference: RFQ-20260102-001

Best regards,
Logistics Team
```

### Tracking Vendor Replies

Vendor replies are matched using:
1. **Primary**: `contact_id` (WhatsApp number or email address)
2. **Secondary**: `rfq_reference` extracted from reply text via OpenAI
3. **Fallback**: Latest open RFQ for that vendor

---

## Approval Workflow

### Three Modes (configured in System Settings)

| Mode | Behavior |
|------|----------|
| **Auto Send** | Quotes automatically marked as `ready_to_send`. Admin can still review in dashboard. |
| **Low Confidence Only** | Only messages with low parsing confidence require manual review. Clear requests auto-process. |
| **Manual Approval** | All quotes start as `pending`. Admin must approve/reject each one. |

### Admin Actions

- **Approve** — Quote moves to `approved`, can revise price
- **Reject** — Quote moves to `rejected`, reason recorded
- **Edit** — Update quote fields before sending

---

## Timeout Processing

### How It Works

1. When an RFQ is created, a waiting period timer starts (default: 30 minutes)
2. The waiting period is configurable in System Settings
3. A cron job or scheduler calls the timeout processor endpoint
4. When the timer expires:
   - System collects all vendor responses
   - Selects the lowest price (converts currencies to TRY)
   - Updates the quote with the vendor price
   - Marks quote as `ready_to_send` (or `pending` based on toggle)
   - Closes the RFQ

### Running the Timeout Processor

**Option A: Vercel Cron Jobs**
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/v1/rfqs/process-timeouts",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Option B: External Scheduler**
Call every 5 minutes:
```bash
curl -H "Authorization: Bearer <AUTH_TOKEN>" \
  https://yourdomain.com/api/v1/rfqs/process-timeouts
```

**Option C: Manual Trigger**
Open the endpoint in browser (requires admin login):
```
https://yourdomain.com/api/v1/rfqs/process-timeouts
```

---

## API Reference

### Incoming Messages

#### `POST /api/v1/quote`
Direct API call with structured or raw data.

**Body:**
```json
{
  "origin_postal_code": "34",
  "destination_postal_code": "10",
  "weight_kg": 3500,
  "language": "tr",
  "channel": "whatsapp",
  "handling_mode": "auto"
}
```

Or with raw message:
```json
{
  "raw_message": "Yükleme yeri: D-45478 Mülheim, Tonaj: 3.500 kg",
  "language": "tr",
  "channel": "whatsapp",
  "handling_mode": "auto"
}
```

### Webhooks

#### `POST /api/webhooks/whatsapp`
Receives WhatsApp messages from provider.

#### `POST /api/webhooks/telegram`
Receives Telegram messages from Bot API.

#### `POST /api/webhooks/email`
Receives parsed emails from email service.

#### `POST /api/webhooks/vendor-reply`
Receives vendor replies from any channel.

**Body:**
```json
{
  "contact_id": "whatsapp:+201234567890",
  "reply_text": "Price is 1500 TRY ref RFQ-20260102-001"
}
```

### Admin Endpoints

#### `GET /api/v1/rfqs/process-timeouts`
Process expired RFQs (run via cron).

#### `POST /api/v1/rfqs`
Manually create an RFQ.

#### `PUT /api/v1/quotes/{id}`
Update quote fields (price, status, etc.).

---

## Environment Variables

```bash
# Database
DATABASE_URL=mysql://user:pass@localhost:3306/logistics_dashboard

# Session
SESSION_SECRET=your-256-bit-secret
AUTH_TOKEN_SECRET=your-jwt-secret

# API Auth (shared secret for webhooks)
AUTH_TOKEN=your-webhook-auth-token

# OpenAI (REQUIRED for automation)
OPENAI_API_KEY=sk-your-openai-key

# WhatsApp via n8n
N8N_WHATSAPP_WEBHOOK_URL=https://your-n8n-instance.com/webhook/send-whatsapp

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## File Structure

```
my-app/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── quote/route.ts          # Main ingress (automation engine)
│   │   │   ├── quotes/                 # Quote CRUD + approval
│   │   │   ├── rfqs/                   # RFQ management
│   │   │   │   ├── route.ts            # List + create RFQs
│   │   │   │   ├── [id]/route.ts       # Get/update RFQ
│   │   │   │   ├── [id]/generate-quote/route.ts
│   │   │   │   └── process-timeouts/route.ts  # Cron endpoint
│   │   │   └── master-data/route.ts    # Vendors, pricing, settings
│   │   └── webhooks/
│   │       ├── whatsapp/route.ts       # WhatsApp listener
│   │       ├── telegram/route.ts       # Telegram listener
│   │       ├── email/route.ts          # Email listener
│   │       └── vendor-reply/route.ts   # Vendor reply listener
│   └── (dashboard)/                    # Admin UI pages
├── lib/
│   ├── automation-engine.ts            # Core automation logic
│   ├── openai.ts                       # AI parsing & response generation
│   ├── pricing.ts                      # Route pricing calculation
│   ├── vendor-selector.ts              # Vendor selection logic
│   ├── geo.ts                          # Postal code resolution
│   ├── toggle.ts                       # System settings cache
│   └── audit.ts                        # Event logging
├── docs/
│   └── quote-rfq-flow.md               # Architecture documentation
└── database.sql                        # Full database schema
```

---

## Quick Start Checklist

- [ ] Set `OPENAI_API_KEY` in `.env.local`
- [ ] Set `AUTH_TOKEN` for webhook security
- [ ] Import route pricing data
- [ ] Add vendors with preferred channels and contact info
- [ ] Configure system settings (toggle mode, waiting period)
- [ ] Set up WhatsApp/Telegram/Email webhooks
- [ ] Configure cron job for `/api/v1/rfqs/process-timeouts`
- [ ] Test with sample messages

---

*Last updated: 2026-05-02*
