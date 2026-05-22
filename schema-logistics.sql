CREATE DATABASE IF NOT EXISTS logistics_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE logistics_dashboard;

-- Shipment Requests
CREATE TABLE IF NOT EXISTS shipment_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(128),
    origin_postal_code VARCHAR(20) NOT NULL,
    destination_postal_code VARCHAR(20) NOT NULL,
    weight_kg DECIMAL(10,2) NOT NULL,
    cargo_type VARCHAR(64),
    language VARCHAR(10) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    raw_payload JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_channel (channel),
    INDEX idx_language (language)
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
    sea_base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    sea_markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    sea_final_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    sea_currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    is_dual_mode BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('pending', 'approved', 'rejected', 'ready_to_send', 'sent') NOT NULL DEFAULT 'pending',
    transport_mode ENUM('road', 'sea') NOT NULL DEFAULT 'road',
    toggle_state_at_creation VARCHAR(32) NOT NULL,
    is_oversize BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason VARCHAR(255),
    response_text TEXT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_request_id) REFERENCES shipment_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES admin_accounts(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_transport_mode (transport_mode),
    INDEX idx_created_at (created_at),
    INDEX idx_channel (channel),
    INDEX idx_language (language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Route Pricing
CREATE TABLE IF NOT EXISTS route_pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    origin_region VARCHAR(64) NOT NULL,
    destination_region VARCHAR(64) NOT NULL,
    base_price DECIMAL(12,2) NOT NULL,
    markup_percent DECIMAL(5,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    is_sea_active BOOLEAN NOT NULL DEFAULT FALSE,
    sea_base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    sea_markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    sea_currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_route (origin_region, destination_region),
    INDEX idx_active (is_active),
    INDEX idx_sea_active (is_sea_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    country_coverage VARCHAR(255) NOT NULL,
    city VARCHAR(128),
    authorized_person_name VARCHAR(128),
    expertise_notes TEXT,
    priority_ranking INT NOT NULL DEFAULT 100,
    use_custom_margin BOOLEAN NOT NULL DEFAULT FALSE,
    margin_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(32),
    telegram_chat_id VARCHAR(64),
    preferred_channels JSON,
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
    selected_vendors JSON,
    vendor_responses JSON,
    generated_quote_price DECIMAL(12,2),
    selected_vendor_id INT NULL,
    status ENUM('draft', 'open', 'responded', 'closed') NOT NULL DEFAULT 'draft',
    messages_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (selected_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
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
    rfq_send_mode ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
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

-- Customer Messaging Windows
CREATE TABLE IF NOT EXISTS customer_messaging_windows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id VARCHAR(128) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_contact_channel (contact_id, channel),
    INDEX idx_last_message (last_message_at)
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
