# Data Model: Core Logistics Intelligence Engine & Admin Command Center

**Feature**: Core Logistics Intelligence Engine & Admin Command Center  
**Date**: 2026-04-28

---

## Entity: Shipment Request

Represents an incoming logistics quote request from an external workflow.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `origin_postal_code` | VARCHAR(20) | NOT NULL | Origin postal code |
| `destination_postal_code` | VARCHAR(20) | NOT NULL | Destination postal code |
| `weight_kg` | DECIMAL(10,2) | NOT NULL | Cargo weight in kilograms |
| `cargo_type` | VARCHAR(64) | NULL | Type of cargo |
| `language` | VARCHAR(10) | NOT NULL | Customer language (ar, tr, en) |
| `channel` | VARCHAR(32) | NOT NULL | Source channel (whatsapp, telegram, email) |
| `raw_payload` | JSON | NOT NULL | Original request payload for audit |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Request time |

### Validation Rules

- `origin_postal_code` and `destination_postal_code`: Must be non-empty, max 20 characters.
- `weight_kg`: Must be greater than 0.
- `language`: Must be one of `ar`, `tr`, `en`.
- `channel`: Must be one of `whatsapp`, `telegram`, `email`.

---

## Entity: Quote

Represents a calculated price offer for a shipment request.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `shipment_request_id` | INT | NOT NULL, FK → shipment_requests(id) | Associated request |
| `origin_region` | VARCHAR(64) | NOT NULL | Resolved origin region |
| `destination_region` | VARCHAR(64) | NOT NULL | Resolved destination region |
| `base_price` | DECIMAL(12,2) | NOT NULL | Base price in TRY |
| `markup_percent` | DECIMAL(5,2) | NOT NULL | Applied markup percentage |
| `final_price` | DECIMAL(12,2) | NOT NULL | Calculated final price in TRY |
| `currency` | VARCHAR(3) | NOT NULL, DEFAULT 'TRY' | Quote currency |
| `status` | ENUM | NOT NULL, DEFAULT 'pending' | `pending`, `approved`, `rejected`, `ready_to_send` |
| `toggle_state_at_creation` | VARCHAR(32) | NOT NULL | Toggle state when quote was created |
| `is_oversize` | BOOLEAN | NOT NULL, DEFAULT FALSE | True if weight > 22 tons |
| `review_reason` | VARCHAR(255) | NULL | Reason for manual review |
| `approved_by` | INT | NULL, FK → admin_accounts(id) | Admin who approved/rejected |
| `approved_at` | TIMESTAMP | NULL | Approval/rejection timestamp |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Quote creation time |

### State Transitions

```
[Created]
  ├── (auto-send + valid + not oversize) ──> [Ready to Send]
  ├── (manual approval OR oversize OR missing data) ──> [Pending Review]
  └── (no internal route + vendor failover) ──> [Pending Review] ──> [RFQ Initiated]

[Pending Review]
  ├── admin approves ──> [Approved] ──> [Ready to Send]
  ├── admin approves with changes ──> [Approved] ──> [Ready to Send]
  └── admin rejects ──> [Rejected]
```

---

## Entity: Route Pricing

Represents predefined pricing for a specific origin-destination route.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `origin_region` | VARCHAR(64) | NOT NULL | Origin logistics region |
| `destination_region` | VARCHAR(64) | NOT NULL | Destination logistics region |
| `base_price` | DECIMAL(12,2) | NOT NULL | Base price in TRY |
| `markup_percent` | DECIMAL(5,2) | NOT NULL | Default markup percentage |
| `currency` | VARCHAR(3) | NOT NULL, DEFAULT 'TRY' | Base currency |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether this route is active |
| `last_updated` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update time |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation time |

### Validation Rules

- `origin_region` + `destination_region` combination must be unique.
- `base_price` must be greater than 0.
- `markup_percent` must be between 0 and 1000.

---

## Entity: Vendor

Represents an external logistics provider.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `name` | VARCHAR(128) | NOT NULL | Vendor name |
| `country_coverage` | VARCHAR(255) | NOT NULL | Comma-separated ISO country codes |
| `expertise_notes` | TEXT | NULL | Free-form expertise descriptions |
| `priority_ranking` | INT | NOT NULL, DEFAULT 100 | Lower is higher priority |
| `contact_email` | VARCHAR(255) | NULL | Primary contact email |
| `contact_phone` | VARCHAR(32) | NULL | Primary contact phone |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether vendor is available |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update time |

---

## Entity: RFQ Record

Represents a vendor failover Request for Quote.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `quote_id` | INT | NOT NULL, FK → quotes(id) | Associated quote |
| `target_country` | VARCHAR(2) | NOT NULL | ISO country code |
| `selected_vendors` | JSON | NOT NULL | Array of selected vendor IDs |
| `vendor_responses` | JSON | NULL | Array of vendor responses with prices |
| `status` | ENUM | NOT NULL, DEFAULT 'open' | `open`, `responded`, `closed` |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update time |

---

## Entity: System Settings

Represents the global operational configuration.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier (single row expected) |
| `master_logic_toggle` | ENUM | NOT NULL, DEFAULT 'manual_approval' | `auto_send`, `low_confidence_only`, `manual_approval` |
| `default_currency` | VARCHAR(3) | NOT NULL, DEFAULT 'TRY' | Base currency for calculations |
| `exchange_rate_reference_date` | DATE | NULL | Date of last exchange rate update |
| `oversize_weight_threshold_tons` | DECIMAL(5,2) | NOT NULL, DEFAULT 22.00 | Threshold for oversize flag |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update time |

---

## Entity: Exchange Rate

Represents daily exchange rates for currency normalization.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `from_currency` | VARCHAR(3) | NOT NULL | Source currency |
| `to_currency` | VARCHAR(3) | NOT NULL | Target currency |
| `rate` | DECIMAL(15,6) | NOT NULL | Exchange rate |
| `effective_date` | DATE | NOT NULL | Rate effective date |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation time |

### Validation Rules

- `from_currency` + `to_currency` + `effective_date` combination must be unique.
- `rate` must be greater than 0.

---

## Entity: Postal Code

Represents the European postal code prefix-to-region mapping.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `country_code` | VARCHAR(2) | NOT NULL | ISO country code |
| `prefix` | VARCHAR(10) | NOT NULL | Postal code prefix (first N characters) |
| `region` | VARCHAR(64) | NOT NULL | Resolved logistics region |
| `prefix_length` | INT | NOT NULL, DEFAULT 2 | Number of characters used for prefix matching |

### Validation Rules

- `country_code` + `prefix` combination must be unique.
- `prefix_length` must be between 1 and 10.

---

## Relationships

```
ShipmentRequest ||--o{ Quote : "generates"
Quote ||--o| RFQRecord : "may trigger"
Quote }o--|| AdminAccount : "approved by"
Vendor ||--o{ RFQRecord : "selected in"
SystemSettings ||--o{ Quote : "governs toggle"
PostalCode ||--o{ Quote : "resolves regions"
RoutePricing ||--o{ Quote : "provides pricing"
ExchangeRate ||--o{ Quote : "normalizes currency"
```

---

## MySQL Schema (DDL)

```sql
-- Shipment Requests
CREATE TABLE IF NOT EXISTS shipment_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    origin_postal_code VARCHAR(20) NOT NULL,
    destination_postal_code VARCHAR(20) NOT NULL,
    weight_kg DECIMAL(10,2) NOT NULL,
    cargo_type VARCHAR(64),
    language VARCHAR(10) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    raw_payload JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_request_id INT NOT NULL,
    origin_region VARCHAR(64) NOT NULL,
    destination_region VARCHAR(64) NOT NULL,
    base_price DECIMAL(12,2) NOT NULL,
    markup_percent DECIMAL(5,2) NOT NULL,
    final_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    status ENUM('pending', 'approved', 'rejected', 'ready_to_send') NOT NULL DEFAULT 'pending',
    toggle_state_at_creation VARCHAR(32) NOT NULL,
    is_oversize BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason VARCHAR(255),
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_request_id) REFERENCES shipment_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES admin_accounts(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Route Pricing
CREATE TABLE IF NOT EXISTS route_pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    origin_region VARCHAR(64) NOT NULL,
    destination_region VARCHAR(64) NOT NULL,
    base_price DECIMAL(12,2) NOT NULL,
    markup_percent DECIMAL(5,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_route (origin_region, destination_region),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    country_coverage VARCHAR(255) NOT NULL,
    expertise_notes TEXT,
    priority_ranking INT NOT NULL DEFAULT 100,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(32),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active),
    INDEX idx_priority (priority_ranking)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RFQ Records
CREATE TABLE IF NOT EXISTS rfq_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quote_id INT NOT NULL,
    target_country VARCHAR(2) NOT NULL,
    selected_vendors JSON NOT NULL,
    vendor_responses JSON,
    status ENUM('open', 'responded', 'closed') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    master_logic_toggle ENUM('auto_send', 'low_confidence_only', 'manual_approval') NOT NULL DEFAULT 'manual_approval',
    default_currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    exchange_rate_reference_date DATE,
    oversize_weight_threshold_tons DECIMAL(5,2) NOT NULL DEFAULT 22.00,
    waiting_period VARCHAR(16) NOT NULL DEFAULT '30m',
    global_markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    vendor_msg_email TEXT,
    vendor_msg_telegram TEXT,
    vendor_msg_whatsapp TEXT,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exchange Rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_rate (from_currency, to_currency, effective_date),
    INDEX idx_effective_date (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Postal Codes
CREATE TABLE IF NOT EXISTS postal_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL,
    prefix VARCHAR(10) NOT NULL,
    region VARCHAR(64) NOT NULL,
    prefix_length INT NOT NULL DEFAULT 2,
    UNIQUE KEY uk_postal (country_code, prefix),
    INDEX idx_prefix (country_code, prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
