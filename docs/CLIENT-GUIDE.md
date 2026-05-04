# Logistics Dashboard — Business User Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Home Dashboard](#home-dashboard)
3. [Quotes](#quotes)
4. [RFQ Management](#rfq-management)
5. [Vendors](#vendors)
6. [Route Pricing](#route-pricing)
7. [System Settings](#system-settings)
8. [Import Data](#import-data)
9. [Unmatched Replies](#unmatched-replies)
10. [Daily Workflow](#daily-workflow)

---

## System Overview

The Logistics Dashboard is an automated quoting system that receives shipment requests from customers via **WhatsApp**, **Telegram**, or **Email**, automatically calculates prices or requests quotes from vendors, and manages the entire process from request to final price delivery.

### How It Works (The Big Picture)

```
Customer sends message (WhatsApp/Telegram/Email)
           ↓
System reads and understands the message
           ↓
Looks up internal pricing for the route
           ↓
├─ Price found? → Send quote to customer automatically
│
└─ No price? → Create RFQ, send to all relevant vendors
           ↓
Vendors reply with their prices
           ↓
System picks the lowest price, adds your margin
           ↓
Admin reviews and approves (or rejects)
           ↓
Customer receives the final price
```

### What This Means for You

- **Customers get instant responses** when routes are covered
- **Vendors compete** for uncovered routes via automatic RFQ
- **You control everything** through approval/rejection
- **No manual data entry** for incoming requests

---

## Home Dashboard

When you log in, the Home page gives you a complete picture of your business:

### Key Metrics (Top Row)

| Metric | What It Means |
|--------|--------------|
| **Revenue** | Total value of all approved quotes |
| **Active Vendors** | Number of vendors ready to receive RFQs |
| **Open RFQs** | RFQs waiting for vendor responses |
| **Unmatched Replies** | Vendor replies that need manual matching |
| **System Mode** | Current automation setting |

### Status Row

- **Total Requests**: All customer messages received
- **Total Quotes**: All quotes created
- **Pending**: Quotes waiting for your action
- **Approved**: Quotes you approved
- **Rejected**: Quotes you rejected
- **Avg Response Time**: How fast you process quotes
- **Approval Rate**: Percentage of quotes you approve

### Coverage Breakdown

Shows how requests are handled:
- **Internal Pricing**: Auto-priced from your route database
- **RFQ**: Sent to vendors for bidding
- **No Coverage**: No pricing AND no vendors available
- **Data Request**: Missing information from customer

### Top Routes

Your most popular shipping lanes — helps you identify which routes need better vendor coverage.

### Recent Pending Quotes

Quick access to quotes that need your attention right now.

---

## Quotes

The Quotes page is your main workspace. This is where you review, approve, and reject customer requests.

### Understanding Quote Cards

Each quote card is color-coded by status:

| Status Color | Meaning | Action Needed |
|-------------|---------|--------------|
| **Amber (Yellow)** | Pending | You need to approve or reject |
| **Green** | Approved | Sent to customer |
| **Red** | Rejected | Customer notified |
| **Blue** | Ready to Send | Auto-approved, sent to customer |

### Card Layout

```
[Status Border] #42  PENDING  Oversize  RFQ
                Customer Name · Egypt → Turkey
                15,000 kg  Origin: 34100  Dest: 10115  EMAIL  EN
                                                    │ 12,500.00 USD │
                                                    │   5/4/2026    │
```

**Left Side**: Quote details — ID, status, customer, route, weight, postal codes, channel, language
**Right Side**: Price and date

### Coverage Badges

- **Internal**: Price came from your route pricing table
- **RFQ**: Price came from vendor bidding
- **No Coverage**: No pricing available, no vendors found
- **Data Request**: Missing required fields

### Filters

Use filters to find specific quotes:
- **Status**: Pending, Approved, Rejected, Ready to Send
- **Channel**: WhatsApp, Telegram, Email
- **Language**: Filters by customer language
- **Date Range**: From/To dates
- **Search**: Search by customer name, route, or currency

### Quote Detail Page

Click any quote to see full details:

**Information Panel** (color-coded by status):
- Customer name and contact
- Origin and destination with postal codes
- Weight and cargo type
- Base price, markup, final price
- Language and channel
- System mode at time of creation

**RFQ Details** (if applicable):
- Shows all vendors who received the RFQ
- Their responses and prices
- Which vendor had the lowest bid (marked "Selected")
- Time remaining until RFQ closes

**Review Decision Panel** (for pending quotes):
- **Approve**: Send the price to customer
  - You can revise the price before sending
  - Add notes for your records
  - Customize the customer message (or let AI generate it)
- **Reject**: Decline the request
  - Add a reason
  - Customer receives rejection message

---

## RFQ Management

RFQ (Request for Quote) is the process of asking vendors for prices when you don't have internal pricing for a route.

### How RFQs Work Automatically

1. Customer requests a quote for a route with no internal price
2. System finds all vendors covering the destination country
3. Sends RFQ to every vendor via their preferred channel (Email or WhatsApp)
4. Vendors reply with their prices
5. After the waiting period expires, system picks the lowest bid
6. Admin reviews and approves/rejects

### RFQ Status

| Status | Color | Meaning |
|--------|-------|---------|
| **Open** | Blue | Waiting for vendor responses |
| **Responded** | Green | Vendors have replied, ready for review |
| **Closed** | Gray | Process completed |

### What You See

Each RFQ card shows:
- RFQ reference number (e.g., RFQ-20260504-001)
- Route (Origin → Destination)
- Target country
- Number of vendors contacted
- Status indicator

### Manual Actions

You don't need to do anything for RFQs to work — they're fully automated. But you can:
- Monitor open RFQs
- Check vendor response rates
- See which routes need more vendor coverage

---

## Vendors

Vendors are your partners who provide prices for routes you don't cover internally.

### Adding a Vendor

1. Go to **Master Data → Vendors**
2. Click **Add Vendor**
3. Fill in the form:

| Field | Required | Description |
|-------|----------|-------------|
| **Name** | Yes | Company name |
| **Country Coverage** | Yes | Which country they serve |
| **City** | No | Specific city if applicable |
| **Priority Ranking** | No | Lower number = higher priority |
| **Use Custom Margin** | No | Check if this vendor has special markup |
| **Margin Rate (%)** | No | Only if custom margin is checked |
| **Email** | No | For email RFQs |
| **Phone** | No | For WhatsApp RFQs |
| **Preferred Channels** | No | Email and/or WhatsApp |
| **Active** | Yes | Whether they receive RFQs |
| **Notes** | No | Any special information |

### Vendor-Specific Margins

Normally, all vendor prices get the **global margin** from Settings. But you can set a custom margin per vendor:

- **Use Global Margin**: Vendor's price × global markup percent
- **Use Vendor Margin**: Vendor's price × their specific markup percent

Example:
- Vendor A: Custom margin 15% → $100 bid → $115 final
- Vendor B: Global margin 20% → $90 bid → $108 final

### Bulk Operations

- Select multiple vendors with checkboxes
- Delete selected vendors in bulk
- Search vendors by name, country, or email

---

## Route Pricing

Route Pricing is your internal price database. When a customer requests a quote for a route that exists here, they get an instant automatic response.

### Adding Route Pricing

1. Go to **Master Data → Route Pricing**
2. Click **Add Pricing**
3. Fill in:

| Field | Required | Description |
|-------|----------|-------------|
| **Origin Region** | Yes | Where shipment starts |
| **Destination Region** | Yes | Where shipment ends |
| **Base Price** | Yes | Your cost for this route |
| **Markup (%)** | Yes | Your profit margin |
| **Currency** | Yes | EUR, USD, TRY, etc. |
| **Active** | Yes | Whether this price is used |

### How Pricing Works

```
Base Price: $1,000
Markup: 20%
Final Price: $1,200
```

The customer receives **$1,200** instantly.

### Importing Pricing

You can import many routes at once using an Excel file:
1. Go to **Master Data → Import Data**
2. Select **Route Pricing**
3. Download the example file to see the format
4. Fill your data and upload

---

## System Settings

Go to **Master Data → System Settings** to configure system behavior.

### Available Settings

| Setting | Options | What It Does |
|---------|---------|--------------|
| **Master Logic Toggle** | Auto Send / Low Confidence Only / Manual Approval | Controls when customers get automatic responses |
| **Default Currency** | TRY, EUR, USD, etc. | Currency used when not specified |
| **Waiting Period** | 1m, 30m, 1h, 2h, etc. | How long to wait for vendor replies before closing RFQ |
| **Global Markup (%)** | 0-1000 | Profit margin added to all vendor prices |

### Master Logic Toggle Explained

**Auto Send**
- Customer gets instant price for covered routes
- RFQ prices go directly to customer after vendors reply
- Fastest mode, least admin work

**Low Confidence Only**
- Auto-sends for high-confidence parsing
- Keeps low-confidence results pending for review
- Balanced approach

**Manual Approval**
- Everything stays pending for admin review
- Even RFQ results wait for your approval
- Maximum control

### Waiting Period

How long the system waits for vendor responses before closing an RFQ:
- **1 minute**: For testing only
- **30 minutes**: Good for urgent requests
- **2 hours**: Standard business practice
- **24 hours**: For vendors in different time zones

---

## Import Data

Instead of adding data one by one, you can bulk import from Excel files.

### Supported Import Types

1. **Postal Codes** — Maps postal code prefixes to regions
2. **Route Pricing** — Bulk import shipping prices
3. **Vendors** — Bulk import vendor contacts

### How to Import

1. Go to **Master Data → Import Data**
2. Select the import type
3. **Download Example XLSX** to see the required format
4. Fill your data in the same format
5. Upload the file
6. System shows how many records were inserted

### Example Files

Always download the example first — it shows exactly what columns and formats are expected.

### Important Notes

- **Vendors**: Each sheet in the Excel file represents one country
- **Route Pricing**: First 2 rows are headers, data starts from row 3
- **Postal Codes**: Supports ranges like "01-09" which expands to 01, 02, 03... 09

---

## Unmatched Replies

Sometimes vendors reply but forget to include the RFQ reference number. These replies land in Unmatched Replies for manual processing.

### Why Replies Become Unmatched

1. Vendor forgot to include RFQ reference
2. Vendor replied from a different email/number
3. Multiple open RFQs for the same vendor
4. Could not extract a price from the reply

### How to Handle

For each unmatched reply, you have 3 options:

**1. Attach to RFQ**
- Click **"Attach to RFQ"**
- Enter the RFQ reference (e.g., RFQ-20260504-001)
- System matches the vendor and records the price

**2. Mark as Resolved**
- Use when you've handled the reply outside the system
- Removes it from the active list

**3. Mark as Ignored**
- Use for spam or irrelevant replies
- Removes it from the active list

### Filters

- **Status**: Unmatched, Resolved, Ignored
- **Date Range**: Find replies from specific periods

---

## Daily Workflow

### Morning Check (5 minutes)

1. Open **Home Dashboard**
2. Check **Pending Quotes** count
3. Check **Open RFQs** count
4. Check **Unmatched Replies** count

### Processing Quotes (as needed)

1. Go to **Quotes**
2. Filter by **Status: Pending**
3. Click each quote to review
4. **Approve** or **Reject** with one click

### Monitoring RFQs (periodic)

1. Go to **RFQ Management**
2. Check which RFQs are still **Open**
3. No action needed — they close automatically

### Handling Unmatched Replies (as needed)

1. Go to **Unmatched Replies**
2. For valid vendor replies, click **Attach to RFQ**
3. Enter the RFQ reference number

### Adding New Vendors (weekly)

1. Go to **Master Data → Vendors**
2. Add new vendors you work with
3. Make sure to set their country coverage and contact details

### Updating Pricing (monthly)

1. Go to **Master Data → Route Pricing**
2. Update prices that have changed
3. Or use **Import Data** to bulk update

---

## Key Business Rules

### When Customers Get Messages

Customers are ONLY notified when:
1. Route has internal pricing AND auto-send is enabled
2. Admin approves a quote
3. Admin rejects a quote

Customers are NEVER notified when:
1. Quote is pending (unless it's in auto-send mode)
2. RFQ is waiting for vendors
3. Data is missing

### Price Calculation

**Internal Pricing:**
```
Final Price = Base Price × (1 + Markup/100)
```

**Vendor Pricing:**
```
Final Price = Lowest Vendor Bid × (1 + Margin/100)
```

### Vendor Selection

- ALL active vendors covering the destination country receive the RFQ
- No limit on vendor count
- System picks the LOWEST bid automatically
- Admin can revise the price before approval

### Oversize Loads

If shipment weight exceeds the threshold (default 22 tons):
- Quote is automatically set to **Pending**
- Reason: "Oversize Load"
- Admin must review manually

---

## Tips for Best Results

1. **Keep vendors updated** — Add vendors for all countries you serve
2. **Set realistic waiting periods** — Give vendors enough time to respond
3. **Review pending quotes quickly** — Customers are waiting
4. **Use manual approval for new routes** — Until you trust the vendor pricing
5. **Monitor top routes** — Add internal pricing for your most popular lanes
6. **Check unmatched replies daily** — Don't lose vendor responses
7. **Keep route pricing current** — Update prices when market rates change

---

## Support

If you encounter issues:
1. Check **Home Dashboard** for system status
2. Review **Unmatched Replies** for lost vendor responses
3. Verify vendor contact details are correct
4. Check that route pricing covers your main lanes

---

*This guide covers the business operations of the Logistics Dashboard. For technical documentation, please refer to the system documentation.*
