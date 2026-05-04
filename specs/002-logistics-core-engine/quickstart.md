# Quickstart: Core Logistics Intelligence Engine & Admin Command Center

**Feature**: Core Logistics Intelligence Engine & Admin Command Center  
**Date**: 2026-04-28

---

## Prerequisites

- Node.js 20+ installed
- MySQL 8.0+ server running locally or accessible via network
- `DATABASE_URL` and `SESSION_SECRET` environment variables configured (from 001-secure-auth-session)

---

## Database Setup

1. Apply the logistics schema (extends the auth schema from 001):

```bash
mysql -u root -p logistics_dashboard < specs/002-logistics-core-engine/schema.sql
```

Or copy the DDL from [data-model.md](./data-model.md) and execute it.

2. **Seed reference data**:

```bash
# Insert sample postal codes
mysql -u root -p logistics_dashboard -e "
INSERT INTO postal_codes (country_code, prefix, region) VALUES
('DE', '10', 'DE-North'), ('DE', '20', 'DE-South'),
('SI', '10', 'SI-West'), ('SI', '20', 'SI-East'),
('HR', '10', 'HR-North'), ('HR', '20', 'HR-South');
"

# Insert sample route pricing
mysql -u root -p logistics_dashboard -e "
INSERT INTO route_pricing (origin_region, destination_region, base_price, markup_percent) VALUES
('DE-North', 'SI-West', 1500.00, 15.00),
('DE-South', 'SI-East', 1800.00, 12.00);
"

# Insert sample vendors
mysql -u root -p logistics_dashboard -e "
INSERT INTO vendors (name, country_coverage, expertise_notes, priority_ranking) VALUES
('BEKİRSAY', 'SI,HR,BA', 'Slovenia specialist, SI-20 route expert', 10),
('Global Freight', 'DE,AT,CH', 'Central Europe coverage', 20);
"

# Insert exchange rates
mysql -u root -p logistics_dashboard -e "
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date) VALUES
('EUR', 'TRY', 35.50, '2026-04-28'),
('USD', 'TRY', 32.80, '2026-04-28');
"

# Initialize system settings
mysql -u root -p logistics_dashboard -e "
INSERT INTO system_settings (master_logic_toggle, default_currency) VALUES
('manual_approval', 'TRY');
"
```

---

## Install Dependencies

From the project root (`my-app/`):

```bash
# Already installed from 001: mysql2, bcryptjs, jose, zod
# No additional runtime dependencies needed for this feature
```

---

## Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## Testing the API Flow

### 1. Submit a Quote Request (n8n simulation)

```bash
curl -X POST http://localhost:3000/api/v1/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "origin_postal_code": "10115",
    "destination_postal_code": "1000",
    "weight_kg": 5000,
    "cargo_type": "General",
    "language": "en",
    "channel": "whatsapp"
  }'
```

Expected: `200 OK` with quote details and status.

### 2. Submit an Oversize Request

```bash
curl -X POST http://localhost:3000/api/v1/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "origin_postal_code": "10115",
    "destination_postal_code": "1000",
    "weight_kg": 25000,
    "language": "en",
    "channel": "email"
  }'
```

Expected: `200 OK` with `is_oversize: true` and `status: pending`.

### 3. Submit a Request with Missing Data

```bash
curl -X POST http://localhost:3000/api/v1/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "origin_postal_code": "10115",
    "destination_postal_code": "1000",
    "language": "en"
  }'
```

Expected: `200 OK` with `status: data_request` and missing fields listed.

### 4. List Pending Quotes (Admin)

```bash
curl http://localhost:3000/api/v1/quotes?status=pending \
  -H "Cookie: session=<your-session-cookie>"
```

### 5. Approve a Quote

```bash
curl -X POST http://localhost:3000/api/v1/quotes/123/approve \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<your-session-cookie>" \
  -d '{"notes": "Approved for dispatch"}'
```

### 6. Update System Settings

```bash
curl -X PUT http://localhost:3000/api/v1/master-data/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<your-session-cookie>" \
  -d '{"master_logic_toggle": "auto_send"}'
```

---

## Running Tests

### Integration Tests

```bash
npm run test:integration
```

Tests cover:
- Quote calculation with internal route pricing
- Vendor failover for uncovered routes
- Oversize load flagging
- Missing data rejection
- Toggle state enforcement
- Admin approve/reject workflow
- Audit trail recording

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on database | Verify MySQL is running and `DATABASE_URL` is correct |
| `auth_token` rejected | Check that the token matches the configured secret |
| Postal code not resolved | Verify `postal_codes` table has the prefix seeded |
| Quote returns `null` pricing | Verify `route_pricing` has a matching origin-destination pair |
| Dashboard not reflecting quotes | Check Server Actions are enabled in Next.js config |

---

## Next Steps

1. Seed production postal code data into `postal_codes` table
2. Import route pricing from Excel files into `route_pricing` table
3. Import vendor database into `vendors` table
4. Configure daily exchange rate updates (cron or external service)
5. Update n8n workflow to point to `/api/v1/quote`
6. Proceed to `/speckit.tasks` to generate implementation tasks
