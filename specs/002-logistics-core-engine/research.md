# Research: Core Logistics Intelligence Engine & Admin Command Center

**Feature**: Core Logistics Intelligence Engine & Admin Command Center  
**Date**: 2026-04-28  
**Purpose**: Resolve technical unknowns and select best-fit patterns for the logistics intelligence engine.

---

## Decision 1: Currency Base & Normalization Strategy

**Decision**: Use TRY (Turkish Lira) as the base currency. All EUR and USD prices are normalized to
TRY using the daily exchange rate before markup application. Final quotes are displayed in TRY.

**Rationale**:
- Business assumption states TRY is the base currency.
- Normalizing to a single base currency prevents compounding rounding errors when applying markups.
- Exchange rates are stored in a dedicated table with daily updates; stale rates (> 24 hours) trigger
  a warning but do not block processing.

**Alternatives considered**:
- **Multi-currency storage (keep original currency)**: Rejected — complicates markup application and
  comparison across routes.
- **USD as base**: Rejected — business operates primarily in the Turkish market.

---

## Decision 2: Master Logic Toggle Storage & Access Pattern

**Decision**: Store the toggle as an ENUM column in a `system_settings` table with a single row.
Cache the value in-memory for 30 seconds to reduce DB load, with a manual cache-bust on admin update.

**Rationale**:
- The toggle is queried on every quote request; caching prevents unnecessary DB hits.
- A single-row settings table is the simplest pattern for global configuration.
- 30-second cache tolerance is acceptable because toggle changes are infrequent and do not need
  instant propagation (admins can wait a few seconds).

**Alternatives considered**:
- **Redis cache**: Rejected — adds external dependency; Constitution requires MySQL as single source
  of truth.
- **Environment variable**: Rejected — requires deployment restart to change; toggle must be
  adjustable at runtime.

---

## Decision 3: Real-time Dashboard Updates

**Decision**: Use Next.js Server Actions with `revalidatePath` for instant UI updates. For the
initial version, polling every 5 seconds is sufficient; Server-Sent Events or WebSockets can be
added later if needed.

**Rationale**:
- Server Actions allow the dashboard to trigger data refreshes without full page reloads.
- `revalidatePath` invalidates cached data so subsequent renders fetch fresh quotes.
- 5-second polling meets the success criterion (dashboard reflects new quotes within 5 seconds).
- WebSockets would add complexity and connection management overhead not justified for < 50 admin
  users.

**Alternatives considered**:
- **WebSockets/Socket.io**: Rejected — overkill for current scale; adds infrastructure complexity.
- **Server-Sent Events (SSE)**: Rejected — harder to implement behind proxies and load balancers;
  polling is simpler and reliable.

---

## Decision 4: Postal Code Resolution Strategy

**Decision**: Direct prefix lookup against a `postal_codes` table with a composite index on
`(country_code, prefix)`. The query uses `LIKE 'prefix%'` with an index range scan.

**Rationale**:
- European postal codes vary in length; the first 2 characters are the consistent prefix.
- A dedicated table with proper indexing ensures sub-100ms lookups even with thousands of rows.
- The `country_code` column disambiguates prefixes that overlap between countries.

**Alternatives considered**:
- **In-memory map (Node.js object)**: Rejected — would require app restart on data updates; MySQL
  table allows dynamic updates via Master Data CRUD.
- **External geocoding API**: Rejected — adds latency, cost, and external dependency.

---

## Decision 5: Quote Calculation Atomicity

**Decision**: Use a single MySQL connection (from the pool) to execute quote INSERT and audit log
INSERT sequentially within the same request handler. Rely on MySQL ACID guarantees rather than
explicit transactions for v1.

**Rationale**:
- Both operations are INSERTs on independent tables; if the quote INSERT succeeds but the log INSERT
  fails, the quote is still valid (log is best-effort for v1).
- Explicit `BEGIN/COMMIT` transactions can be added in v2 if stricter atomicity is required.
- Simpler implementation reduces risk of connection pool exhaustion from long-held transactions.

**Alternatives considered**:
- **Explicit transactions (`BEGIN...COMMIT`)**: Rejected for v1 — adds complexity and connection
  holding time; can be added later if audit completeness becomes critical.
- **Two-phase commit**: Rejected — completely unnecessary for a single-database system.

---

## Decision 6: Vendor Failover Ranking

**Decision**: Rank vendors by a composite score: `priority_ranking` (admin-configured) + keyword
match count in `expertise_notes` against the target country/region. Select top 3.

**Rationale**:
- Simple, transparent, and admin-controllable.
- Keyword matching on `expertise_notes` captures unstructured domain knowledge (e.g., "Slovenia",
  "SI-20", "Balkan specialist").
- Historical performance data can be incorporated into the score in v2.

**Alternatives considered**:
- **ML-based ranking**: Rejected — no historical performance data available for v1; over-engineered.
- **Fixed vendor lists per country**: Rejected — less flexible; requires schema changes when vendors
  expand coverage.

---

## Decision 7: API Versioning

**Decision**: Version the external API as `/api/v1/quote` to allow future breaking changes without
disrupting n8n workflows.

**Rationale**:
- n8n workflows are external and may not be updated simultaneously with the app.
- Versioning in the URL path is the most discoverable and proxy-friendly approach.
- v1 will remain stable; v2 can be introduced later with extended fields or new endpoints.

**Alternatives considered**:
- **Header-based versioning (`Accept: application/vnd.logistics.v1+json`)**: Rejected — harder to
  configure in n8n HTTP nodes.
- **No versioning**: Rejected — risky for a production integration with external automation.

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|------------|
| How to store the three-way toggle? | Single-row `system_settings` table with ENUM column |
| How to achieve real-time dashboard? | Server Actions + `revalidatePath` + 5s polling |
| How to resolve postal codes efficiently? | Indexed `postal_codes` table with prefix lookup |
| How to ensure quote + audit atomicity? | Sequential INSERTs on same connection; v2 may add transactions |
| How to rank vendors for failover? | Composite score: priority_ranking + expertise keyword match |
| How to version the n8n API? | URL path versioning (`/api/v1/quote`) |
