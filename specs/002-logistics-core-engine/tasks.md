---

description: "Task list template for feature implementation"
---

# Tasks: Core Logistics Intelligence Engine & Admin Command Center

**Input**: Design documents from `/specs/002-logistics-core-engine/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are NOT included for this feature as they were not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `my-app/` is the project root
- All paths shown below are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and directory structure for the logistics engine

- [X] T001 Create logistics feature directory structure in my-app/ per implementation plan (app/(dashboard)/quotes/, app/(dashboard)/rfqs/, app/(dashboard)/master-data/, app/(dashboard)/history/, app/api/v1/, components/quotes/, components/rfqs/, components/master-data/, types/)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Apply MySQL schema for logistics tables (shipment_requests, quotes, route_pricing, vendors, rfq_records, system_settings, exchange_rates, postal_codes) using DDL from data-model.md
- [X] T003 [P] Create logistics TypeScript types in my-app/types/logistics.ts (ShipmentRequest, Quote, RoutePricing, Vendor, SystemSettings, RFQRecord, ExchangeRate, PostalCode interfaces)
- [X] T004 Create postal code resolver module in my-app/lib/geo.ts (resolveRegionFromPostalCode function using prefix lookup)
- [X] T005 Create currency normalization module in my-app/lib/currency.ts (normalizeToBaseCurrency function using exchange_rates table)
- [X] T006 Create pricing engine module in my-app/lib/pricing.ts (calculateQuote function: base price + markup, handles internal routing and currency normalization)
- [X] T007 Create toggle state module in my-app/lib/toggle.ts (getMasterLogicToggle function with 30-second in-memory cache from system_settings)
- [X] T008 [P] Create vendor selector module in my-app/lib/vendor-selector.ts (selectTopVendors function: rank by priority + expertise keyword match)
- [X] T009 [P] Update audit helper in my-app/lib/audit.ts (add logPricingEvent and logVendorEvent functions for logistics-specific system_logs entries)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Shipment Quote Processing (Priority: P1) 🎯 MVP

**Goal**: External n8n workflows can submit shipment requests and receive calculated quotes with appropriate status

**Independent Test**: POST a valid JSON payload to /api/v1/quote and verify the response contains either a calculated price with currency breakdown or a clear "pending review" status with reason

### Implementation for User Story 1

- [X] T010 [P] [US1] Create Zod validation schema in my-app/lib/validation.ts (shipmentRequestSchema with Weight, Origin, Destination, Language validation)
- [X] T011 [P] [US1] Create auth token verification helper in my-app/lib/auth-token.ts (verifyAuthToken middleware for n8n requests)
- [X] T012 [US1] Create quote ingress API route in my-app/app/api/v1/quote/route.ts (validate with Zod, resolve postal codes, calculate pricing, check toggle, handle oversize, create quote record, log event)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Admin Quote Review & Approval (Priority: P1) 🎯 MVP

**Goal**: Administrators can view, approve, edit, or reject pending quotes through the dashboard

**Independent Test**: Create a pending quote in the database, navigate to the admin review interface, perform approve/edit/reject actions, and verify status updates correctly with audit logs

### Implementation for User Story 2

- [X] T013 [P] [US2] Create quotes list API route in my-app/app/api/v1/quotes/route.ts (GET with status/date filters and pagination)
- [X] T014 [P] [US2] Create quote approve API route in my-app/app/api/v1/quotes/[id]/approve/route.ts (POST with optional revised_price and notes)
- [X] T015 [P] [US2] Create quote reject API route in my-app/app/api/v1/quotes/[id]/reject/route.ts (POST with required reason)
- [X] T016 [US2] Create quotes list page in my-app/app/(dashboard)/quotes/page.tsx (displays pending quotes with real-time updates via Server Actions)
- [X] T017 [P] [US2] Create quote card component in my-app/components/quotes/quote-card.tsx (displays quote summary with status badge)
- [X] T018 [US2] Create quote detail/review page in my-app/app/(dashboard)/quotes/[id]/page.tsx (full quote details with approve/edit/reject controls)
- [X] T019 [P] [US2] Create quote review form component in my-app/components/quotes/quote-review-form.tsx (approve with optional price edit, reject with reason)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Vendor Failover & RFQ Management (Priority: P2)

**Goal**: When internal pricing is absent, the system selects top 3 vendors and initiates an RFQ workflow trackable in the dashboard

**Independent Test**: Submit a request for a route with no internal price and verify the system returns an RFQ-initiated status, lists the top 3 vendors, and creates a trackable RFQ record in the dashboard

### Implementation for User Story 3

- [X] T020 [US3] Update quote ingress API route in my-app/app/api/v1/quote/route.ts to handle vendor failover path (no internal route → identify country → select top 3 vendors → create RFQ record)
- [X] T021 [P] [US3] Create RFQ list API route in my-app/app/api/v1/rfqs/route.ts (GET with status filters)
- [X] T022 [P] [US3] Create RFQ update API route in my-app/app/api/v1/rfqs/[id]/route.ts (POST vendor responses, update status)
- [X] T023 [US3] Create RFQ list page in my-app/app/(dashboard)/rfqs/page.tsx (displays RFQ records with vendor status)
- [X] T024 [P] [US3] Create RFQ list component in my-app/components/rfqs/rfq-list.tsx (displays RFQ cards with vendor responses)

**Checkpoint**: User Story 3 should now be independently functional

---

## Phase 6: User Story 4 - Master Data Management (Priority: P2)

**Goal**: Administrators can manage vendors, route pricing, exchange rates, and the Master Logic Toggle through CRUD interfaces

**Independent Test**: Create a new vendor record, update a route price, change the toggle setting, and verify subsequent quote calculations reflect the updated data

### Implementation for User Story 4

- [X] T025 [P] [US4] Create master data API route in my-app/app/api/v1/master-data/route.ts (GET/POST/PUT/DELETE for vendors, pricing, settings, exchange rates)
- [X] T026 [P] [US4] Create vendor CRUD page in my-app/app/(dashboard)/master-data/vendors/page.tsx (list, create, edit vendors)
- [X] T027 [P] [US4] Create route pricing CRUD page in my-app/app/(dashboard)/master-data/pricing/page.tsx (list, create, edit pricing records)
- [X] T028 [US4] Create system settings page in my-app/app/(dashboard)/master-data/settings/page.tsx (edit Master Logic Toggle and default currency)
- [X] T029 [P] [US4] Create exchange rates page in my-app/app/(dashboard)/master-data/exchange-rates/page.tsx (list, create, edit rates)
- [X] T030 [P] [US4] Create vendor form component in my-app/components/master-data/vendor-form.tsx (create/edit vendor with country coverage and expertise)
- [X] T031 [P] [US4] Create pricing form component in my-app/components/master-data/pricing-form.tsx (create/edit route pricing with origin, destination, base price, markup)
- [X] T032 [P] [US4] Create settings form component in my-app/components/master-data/settings-form.tsx (toggle selection with validation)

**Checkpoint**: User Story 4 should now be independently functional

---

## Phase 7: User Story 5 - Transaction History & Audit Trail (Priority: P3)

**Goal**: Administrators can search and review the complete lifecycle of quote requests with full audit context

**Independent Test**: Query the history after several quotes have been processed and verify all events are chronologically listed with full context

### Implementation for User Story 5

- [X] T033 [US5] Create history API route in my-app/app/api/v1/history/route.ts (GET with date range, status, route filters and pagination)
- [X] T034 [US5] Create transaction history page in my-app/app/(dashboard)/history/page.tsx (searchable list with filters and export)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T035 [P] Integrate status badge component into quote cards and RFQ list (use color-coded statuses per Constitution V)
- [X] T036 Add error handling and loading states to all dashboard pages and components (loading spinners, network error messages, empty states)
- [X] T037 Code cleanup and consistency review across logistics modules (ensure all imports use alias paths, verify no raw prices in logs, validate ENUM usage)
- [X] T038 [P] Seed reference data scripts (postal codes, route pricing, vendors, exchange rates, system settings) for development testing
- [X] T039 Run quickstart.md validation steps (build passes, TypeScript clean, all routes registered; runtime curl tests require running MySQL/server)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - T002 depends on T001
  - T003-T009 can run in parallel after T002
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
  - T012 depends on T010, T011
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) and after US1 quote creation exists
  - T013-T015 depend on T012 (quote API creates records that US2 reads)
  - T016-T019 depend on T013-T015
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) and after US1 quote ingress exists
  - T020 depends on T012 (extends quote ingress with failover)
  - T021-T024 depend on T020
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
  - T025-T032 are independent of US1-US3
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) and after US1-US4 create data
  - T033-T034 depend on quotes and RFQs existing in the system

### Within Each User Story

- Types/validation before services/helpers
- Services/helpers before API routes
- API routes before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US1, US2, and US4 can start in parallel
- US3 can start after US1 is complete
- US5 can start after US1-US4 are complete
- T010 and T011 (US1) can run in parallel
- T013, T014, T015 (US2) can run in parallel
- T016 and T017 (US2) can run in parallel after T013
- T021, T022, T023 (US3) can run in parallel after T020
- T025, T026, T027, T028, T029 (US4) can run in parallel
- T030, T031, T032 (US4) can run in parallel
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch validation schema and auth helper together:
Task: "Create Zod validation schema in my-app/lib/validation.ts"
Task: "Create auth token verification helper in my-app/lib/auth-token.ts"

# Then create the API route (depends on both):
Task: "Create quote ingress API route in my-app/app/api/v1/quote/route.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Quote Processing)
4. Complete Phase 4: User Story 2 (Quote Review)
5. **STOP and VALIDATE**: Test quote submission and admin approval workflow independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Quote Processing)
   - Developer B: User Story 2 (Quote Review)
   - Developer C: User Story 4 (Master Data)
3. Once US1 is complete:
   - Developer A: User Story 3 (Vendor Failover)
4. Once US1-US4 are complete:
   - Developer B: User Story 5 (Transaction History)
5. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
