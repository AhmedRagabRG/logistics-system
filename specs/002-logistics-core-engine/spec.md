# Feature Specification: Core Logistics Intelligence Engine & Admin Command Center

**Feature Branch**: `002-logistics-core-engine`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "Project: Core Logistics Intelligence Engine & Admin Command Center. We are building the central nervous system for a logistics operation. This is a Next.js-based system that processes pre-analyzed shipment data (received via HTTP requests) to execute pricing logic, vendor routing, and operational oversight. Core Functional Components: Centralized API Ingress, Geographical Zone Resolver, Automated Pricing Core, Vendor Failover, Unified Admin Dashboard with Master Logic Toggle, Offer & Transaction Management, Master Data CRUD. Operational Guardrails: Payload Validation, Human-in-the-Loop Check, Oversize Load Handling, Multi-Currency Engine."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shipment Quote Processing (Priority: P1)

An external automation workflow (n8n) sends a structured shipment request containing origin, destination, weight, and cargo details to the system's API endpoint. The system validates the payload, resolves geographical zones from postal code prefixes, looks up internal route pricing, applies markup rules, checks the current approval toggle state, and returns either a calculated quote with send authorization or a pending-review status.

**Why this priority**: This is the core value proposition of the entire system. Without automated quote processing, the logistics operation cannot move from manual Excel-based pricing to a centralized, consistent decision engine. Every other feature supports or consumes this primary flow.

**Independent Test**: Can be fully tested by sending a valid JSON payload to the API endpoint and verifying that the response contains either a calculated price with currency breakdown or a clear "pending review" status with reason.

**Acceptance Scenarios**:

1. **Given** a valid shipment request with matching internal route pricing and the toggle set to "Auto-send", **When** the API receives the request, **Then** it returns a complete quote with base price, markup, normalized currency, and "Ready to Send" authorization.
2. **Given** a shipment request with weight greater than 22 tons, **When** the API processes it, **Then** it automatically strips auto-send privileges, flags it as "Oversize Load — Manual Review Required", and returns a pending status regardless of the toggle setting.
3. **Given** a shipment request where the toggle is set to "Manual Approval", **When** the API processes it, **Then** it calculates the quote but returns "Pending Review" status without send authorization.

---

### User Story 2 - Admin Quote Review & Approval (Priority: P1)

An administrator logs into the dashboard and sees a real-time list of pending quotes awaiting their decision. They can inspect each quote's details (origin, destination, weight, calculated price, applied markup), approve it for immediate dispatch, edit the price or terms before approval, or reject it with a reason. Approved quotes transition to "Ready to Send"; rejected quotes are archived with audit trail.

**Why this priority**: The Human-in-the-Loop capability is the operational safety net that allows the business to scale automation confidence gradually. Without admin oversight, automated quotes cannot be trusted for high-value or exception shipments.

**Independent Test**: Can be tested by creating a pending quote in the database, navigating to the admin review interface, performing approve/edit/reject actions, and verifying that the quote status updates correctly and audit logs capture each decision.

**Acceptance Scenarios**:

1. **Given** a pending quote in the system, **When** an admin clicks "Approve", **Then** the quote status changes to "Approved", the system logs the decision with admin identity and timestamp, and the external workflow receives authorization to send the quote.
2. **Given** a pending quote, **When** an admin edits the price and clicks "Approve with Changes", **Then** the system stores the revised price, logs the edit, and authorizes dispatch with the updated terms.
3. **Given** a pending quote, **When** an admin clicks "Reject", **Then** the quote status changes to "Rejected", the admin's reason is recorded, and no external message is triggered.

---

### User Story 3 - Vendor Failover & RFQ Management (Priority: P2)

A shipment request arrives for a route that has no internal pricing coverage. The system identifies the destination country from the postal code, queries the vendor database for specialized dealers serving that region (e.g., BEKİRSAY for Slovenia), ranks the top 3 vendors based on expertise notes and historical performance, and initiates an RFQ (Request for Quote) workflow. The admin dashboard displays the RFQ status and vendor responses.

**Why this priority**: Vendor failover ensures the business never turns away a customer due to incomplete internal coverage. It extends the system's value from "automated pricing for known routes" to "comprehensive sourcing for all routes", but it depends on the core quote processing being functional first.

**Independent Test**: Can be tested by submitting a request for a route with no internal price and verifying that the system returns an RFQ-initiated status, lists the top 3 vendors, and creates a trackable RFQ record in the dashboard.

**Acceptance Scenarios**:

1. **Given** a shipment request with no matching internal route, **When** the API processes it, **Then** it identifies the destination country, selects the top 3 vendors from the vendor database based on regional expertise, and returns an "RFQ Initiated" status with vendor names.
2. **Given** an RFQ record in the dashboard, **When** a vendor responds with a price, **Then** the admin can view the response, compare vendor offers, and select one to convert into a customer quote.

---

### User Story 4 - Master Data Management (Priority: P2)

An administrator accesses the Master Data section of the dashboard to maintain the system's reference data. They can add or edit vendors with regional expertise tags, update internal route pricing tables with base prices and markup percentages, configure the Master Logic Toggle default state, and manage currency exchange rates. All changes are validated and logged.

**Why this priority**: Master data quality directly impacts quote accuracy. However, the system can operate with pre-seeded data; the CRUD interface enables ongoing maintenance without requiring database access.

**Independent Test**: Can be tested by creating a new vendor record, updating a route price, changing the toggle setting, and verifying that subsequent quote calculations reflect the updated data.

**Acceptance Scenarios**:

1. **Given** the master data interface, **When** an admin adds a new vendor with "Slovenia" expertise, **Then** the vendor appears in the database and becomes eligible for Slovenia route failover selection.
2. **Given** the pricing table, **When** an admin updates the markup percentage for a specific route, **Then** the next quote request for that route uses the new markup.
3. **Given** the system settings panel, **When** an admin changes the toggle from "Auto-send" to "Manual Approval", **Then** all subsequent quote requests return "Pending Review" status.

---

### User Story 5 - Transaction History & Audit Trail (Priority: P3)

An administrator navigates to the Transaction History page to review the complete lifecycle of any quote request. They can search by date range, customer, route, or status, view the full audit trail including who approved what and when, see applied markups and vendor selections, and export records for reporting.

**Why this priority**: Audit visibility is critical for business accountability and regulatory compliance, but it is a read-only reporting feature that adds value after the operational workflows are established.

**Independent Test**: Can be tested by querying the history after several quotes have been processed and verifying that all events (creation, pricing, approval, rejection, vendor selection) are chronologically listed with full context.

**Acceptance Scenarios**:

1. **Given** multiple processed quotes in the system, **When** an admin opens the transaction history, **Then** they see a chronological list with statuses, prices, decision makers, and timestamps.
2. **Given** the transaction history, **When** an admin applies a date range filter, **Then** only quotes within that range are displayed.

---

### Edge Cases

- What happens when the origin or destination postal code prefix is not found in the European Postal Code database?
- How does the system handle a request with missing critical fields (Weight, Origin, Destination) after Zod validation fails?
- What happens when the exchange rate for a currency pair is stale or missing?
- How does the system respond when the SystemSettings table has no toggle configuration?
- What happens when multiple requests for the same route arrive simultaneously and internal pricing is being updated?
- How does the system handle a vendor failover when fewer than 3 vendors serve the destination country?
- What happens when an admin attempts to approve a quote that has already been approved or rejected by another admin?
- How does the system handle currency rounding when normalizing between EUR, USD, and TRY?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a secured API endpoint that accepts structured JSON shipment requests from external workflows.
- **FR-002**: System MUST validate every incoming request payload against a strict schema requiring Weight, Origin, Destination, and Language fields.
- **FR-003**: System MUST reject requests with missing or invalid critical data and return a "Data Request Template" response instead of generating a speculative quote.
- **FR-004**: System MUST use the first two characters of the postal code (Prefix) to resolve origin and destination regions for pricing lookups.
- **FR-005**: System MUST check the internal Route Pricing tables for a matching origin-destination route and, if found, calculate the customer quote by applying the predefined markup percentage.
- **FR-006**: System MUST normalize all pricing calculations to a base currency using the daily exchange rate before applying markups and displaying the final quote.
- **FR-007**: System MUST query the SystemSettings table for the current Master Logic Toggle state before deciding whether to authorize immediate dispatch or hold for review.
- **FR-008**: System MUST support a three-way toggle: "Auto-send" (high-confidence quotes authorized immediately), "Low Confidence Only" (only uncertain quotes held for review), and "Manual Approval" (all quotes held for review).
- **FR-009**: System MUST automatically flag any shipment with weight greater than 22 tons as "Oversize Load" and force it into manual review regardless of the toggle state.
- **FR-010**: System MUST identify the target country when no internal route price exists and select the top 3 vendors from the vendor database based on regional expertise notes.
- **FR-011**: System MUST provide an admin dashboard interface to view, approve, edit, or reject pending quotes in real time.
- **FR-012**: System MUST record every automated decision (selected vendor, applied markup, toggle state, approval action) in the system_logs table for accountability.
- **FR-013**: System MUST provide Master Data CRUD interfaces for managing vendors, internal route pricing, markup settings, exchange rates, and the Master Logic Toggle.
- **FR-014**: System MUST ensure that all automated responses match the customer's input language (Arabic, Turkish, or English).
- **FR-015**: System MUST enforce auth_token verification on every HTTP request from external workflows.

### Key Entities *(include if feature involves data)*

- **Shipment Request**: Represents an incoming logistics quote request. Key attributes include origin postal code, destination postal code, weight, cargo type, language, and channel source.
- **Quote**: Represents a calculated price offer. Key attributes include base price, markup percentage, final price, currency, status (Pending, Approved, Rejected, Ready to Send), and associated shipment request.
- **Route Pricing**: Represents predefined pricing for a specific origin-destination route. Key attributes include origin region, destination region, base price, and markup percentage.
- **Vendor**: Represents an external logistics provider. Key attributes include name, country coverage, expertise notes, priority ranking, and contact details.
- **System Settings**: Represents the operational configuration. Key attributes include the Master Logic Toggle state, default currency, and exchange rate reference date.
- **RFQ Record**: Represents a vendor failover request. Key attributes include associated quote, target country, selected vendor list, vendor responses, and status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of valid shipment requests receive an automated quote or clear pending status within 3 seconds of API reception.
- **SC-002**: 100% of requests with weight greater than 22 tons are flagged for manual review and never authorized for auto-send.
- **SC-003**: 100% of requests with missing critical data trigger a "Data Request Template" response instead of a speculative quote.
- **SC-004**: Administrators can review, approve, edit, or reject a pending quote in under 60 seconds from dashboard entry to decision.
- **SC-005**: Internal route pricing lookups complete in under 500 milliseconds for 99% of requests.
- **SC-006**: Vendor failover selects the correct top 3 vendors for the destination country in 100% of test cases with seeded vendor data.
- **SC-007**: All automated pricing decisions (markup applied, vendor selected, toggle state) are queryable in the audit trail within 1 second of the decision.
- **SC-008**: The admin dashboard reflects new pending quotes within 5 seconds of API processing without requiring a page refresh.

## Assumptions

- The European Postal Code database has been migrated to MySQL with prefix-to-region mappings.
- Internal route pricing and vendor data are pre-seeded from Excel files; the CRUD interface enables ongoing maintenance.
- Exchange rates are updated at least daily; stale rates older than 24 hours trigger a warning but do not block processing.
- The external n8n workflow handles the actual customer communication (WhatsApp, Telegram, Email); this system only authorizes or holds the response.
- Administrator authentication is handled by the existing Secure Authentication & Session Management module (001-secure-auth-session).
- Currency base is TRY; EUR and USD are normalized to TRY before markup application.
- A "Low Confidence" quote is defined as one where the route pricing record is older than 90 days or the vendor failover path is triggered.
