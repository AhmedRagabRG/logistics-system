# Implementation Plan: Core Logistics Intelligence Engine & Admin Command Center

**Branch**: `002-logistics-core-engine` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-logistics-core-engine/spec.md`

## Summary

Build the central nervous system for a logistics operation: a Next.js-based intelligence engine that
receives structured shipment requests from n8n, resolves geographical zones via postal code prefix
lookups, calculates quotes using internal route pricing with dynamic markup, handles vendor failover
for uncovered routes, and presents a unified admin dashboard for quote review, master data CRUD, and
audit visibility. The system respects a three-way Master Logic Toggle (Auto-send | Low Confidence
Only | Manual Approval) and enforces operational guardrails (oversize load handling, missing data
rejection, multi-currency normalization).

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 16.x (App Router), React 19.x
**Primary Dependencies**: Next.js, Tailwind CSS v4, mysql2 (MySQL driver), jose (JWT/session signing), zod (schema validation)
**Storage**: MySQL (single source of truth per Constitution I)
**Testing**: Vitest (already configured in project)
**Target Platform**: Modern web browsers (desktop primary), n8n HTTP clients
**Project Type**: Web application + API service
**Performance Goals**: Quote processing < 3s for 95% of requests; pricing lookup < 500ms for 99% of requests; dashboard refresh < 5s
**Constraints**: HTTP-only cookies for auth; auth_token verification on every n8n request; atomic DB transactions before external messages; no localStorage for auth tokens
**Scale/Scope**: Single-tenant admin dashboard; < 50 concurrent admin sessions; European postal code DB with thousands of prefix-to-region mappings

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Notes |
|-----------|-------|--------|-------|
| I. Operational Mode Governance | Three-way toggle respected | ✅ PASS | Auto-send, Low Confidence Only, Manual Approval modes implemented |
| I. Operational Mode Governance | Single Source of Truth | ✅ PASS | All quote, pricing, vendor, and session data stored in MySQL only |
| II. Geographical & Pricing Logic | Prefix-based zoning | ✅ PASS | First two chars of postal code resolve regions |
| II. Geographical & Pricing Logic | Internal routing + markup | ✅ PASS | Route Pricing tables with predefined markups |
| II. Geographical & Pricing Logic | Vendor failover (top 3) | ✅ PASS | Target country identified, vendors ranked by expertise |
| II. Geographical & Pricing Logic | Currency normalization | ✅ PASS | Daily exchange rate (EUR/USD → TRY) before markup |
| III. Technical Standards | Next.js App Router + MySQL | ✅ PASS | Matches approved tech stack |
| III. Technical Standards | Zod validation on n8n requests | ✅ PASS | Strict payload validation for Weight, Origin, Destination, Language |
| III. Technical Standards | auth_token verification | ✅ PASS | Every n8n request validated |
| III. Technical Standards | Atomic transactions | ✅ PASS | Quote status committed before external message trigger |
| IV. Automation Guardrails | Missing data handling | ✅ PASS | Data Request Template response instead of guessing |
| IV. Automation Guardrails | Weight limit (22 tons) | ✅ PASS | Oversize Load flag forces manual review |
| IV. Automation Guardrails | Language policy | ✅ PASS | Responses match input language (AR, TR, EN) |
| V. Development Workflow | Schema First | ✅ PASS | MySQL schema defined before UI components |
| V. Development Workflow | Audit Logging | ✅ PASS | Every decision logged to system_logs |
| V. Development Workflow | Clean UI | ✅ PASS | Statuses color-coded per Constitution |

## Project Structure

### Documentation (this feature)

```text
specs/002-logistics-core-engine/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
my-app/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Protected dashboard layout (from 001)
│   │   ├── page.tsx                # Dashboard home
│   │   ├── quotes/
│   │   │   ├── page.tsx            # Pending quotes list
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Quote detail / review
│   │   ├── rfqs/
│   │   │   └── page.tsx            # RFQ management
│   │   ├── master-data/
│   │   │   ├── vendors/
│   │   │   ├── pricing/
│   │   │   ├── exchange-rates/
│   │   │   └── settings/
│   │   └── history/
│   │       └── page.tsx            # Transaction history
│   ├── api/
│   │   ├── v1/
│   │   │   ├── quote/
│   │   │   │   └── route.ts        # Main ingress endpoint for n8n
│   │   │   ├── quotes/
│   │   │   │   └── route.ts        # Admin quote CRUD
│   │   │   ├── rfqs/
│   │   │   │   └── route.ts        # RFQ management
│   │   │   └── master-data/
│   │   │       └── route.ts        # Master data CRUD
│   │   └── auth/                   # From 001-secure-auth-session
│   └── layout.tsx
├── lib/
│   ├── db.ts                       # MySQL connection pool
│   ├── pricing.ts                  # Quote calculation engine
│   ├── geo.ts                      # Postal code prefix resolver
│   ├── currency.ts                 # Exchange rate normalization
│   ├── toggle.ts                   # Master Logic Toggle state
│   ├── audit.ts                    # system_logs helper
│   └── session.ts                  # From 001-secure-auth-session
├── components/
│   ├── quotes/
│   │   ├── quote-list.tsx          # Real-time pending list
│   │   ├── quote-card.tsx          # Individual quote card
│   │   └── quote-review-form.tsx   # Approve/edit/reject form
│   ├── rfqs/
│   │   └── rfq-list.tsx            # RFQ status display
│   ├── master-data/
│   │   ├── vendor-form.tsx
│   │   ├── pricing-form.tsx
│   │   └── settings-form.tsx
│   └── ui/
│       └── status-badge.tsx        # From 001
├── types/
│   ├── auth.ts                     # From 001
│   └── logistics.ts                # Shipment, Quote, RFQ types
└── tests/
    └── integration/
        └── logistics.test.ts
```

**Structure Decision**: Single Next.js 16 App Router project extending the auth system from
001-secure-auth-session. The `(dashboard)` route group already has protected layout and session
management. New sub-routes are added under the existing dashboard for quotes, RFQs, master data, and
history. API routes use a `/api/v1/` namespace for versioning. Business logic is isolated in `lib/`
modules (pricing, geo, currency, toggle) to keep API routes thin and testable.

## Complexity Tracking

> No Constitution Check violations require justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Research

See [research.md](./research.md) for full details.

**Key Decisions**:
- **Currency Base**: TRY as base currency per business assumption; EUR/USD normalized via daily rates
- **Three-Way Toggle**: Stored as ENUM in SystemSettings table; queried on every quote request
- **Real-time UI**: Server Actions with `revalidatePath` for instant dashboard updates without full reload
- **Postal Code Resolution**: Direct prefix lookup in MySQL with indexed `postal_codes` table
- **Quote Atomicity**: INSERT quote + INSERT system_logs within same connection to guarantee audit trail

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md) and [contracts/](./contracts/) for full details.

**Entities**: Shipment Request, Quote, Route Pricing, Vendor, System Settings, RFQ Record, Postal Code, Exchange Rate
**Contracts**: Quote API (n8n ingress), Admin Quote CRUD, RFQ API, Master Data API

## Quickstart

See [quickstart.md](./quickstart.md) for local development setup and testing instructions.

## Post-Design Constitution Check

Re-evaluated after Phase 1 — all gates still **PASS** ✅.
