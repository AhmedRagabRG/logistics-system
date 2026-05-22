-- ============================================================
-- Logistics Dashboard - Complete Database Setup
-- Includes: Auth, Logistics Schema, Indexes, Seed Data
-- Run: mysql -u root -p < database.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS supet_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE supet_db;

-- ============================================================
-- 1. AUTHENTICATION & AUDIT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    admin_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE,
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    admin_id INT,
    session_token VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    details JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE SET NULL,
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. LOGISTICS CORE TABLES
-- ============================================================

-- Shipment Requests (incoming messages from any channel)
CREATE TABLE IF NOT EXISTS shipment_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(128),
    customer_contact VARCHAR(128),
    raw_message TEXT,
    origin_postal_code VARCHAR(20),
    destination_postal_code VARCHAR(20),
    weight_kg DECIMAL(10,2),
    cargo_type VARCHAR(64),
    language VARCHAR(10) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    raw_payload JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_channel (channel),
    INDEX idx_language (language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quotes (generated from shipment requests)
CREATE TABLE IF NOT EXISTS quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_request_id INT NOT NULL,
    origin_region VARCHAR(64) NOT NULL,
    destination_region VARCHAR(64) NOT NULL,
    origin_postal_code VARCHAR(20),
    destination_postal_code VARCHAR(20),
    weight_kg DECIMAL(10,2),
    cargo_type VARCHAR(64),
    base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    final_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    sea_base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    sea_markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    sea_final_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    sea_currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    is_dual_mode BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('pending', 'approved', 'rejected', 'ready_to_send', 'sent') NOT NULL DEFAULT 'pending',
    handling_mode ENUM('auto', 'manual', 'external') NOT NULL DEFAULT 'manual',
    transport_mode ENUM('road', 'sea') NOT NULL DEFAULT 'road',
    rfq_id INT,
    toggle_state_at_creation VARCHAR(32) NOT NULL DEFAULT 'manual_approval',
    is_oversize BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason VARCHAR(255),
    response_text TEXT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_request_id) REFERENCES shipment_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES admin_accounts(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_handling_mode (handling_mode),
    INDEX idx_transport_mode (transport_mode),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Route Pricing (internal pricing matrix)
-- One row per route. Road price is always present.
-- Sea price is optional: toggle is_sea_active to enable it.
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

-- Vendors (dealer/supplier network)
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

-- RFQ Records (vendor failover)
CREATE TABLE IF NOT EXISTS rfq_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quote_id INT NOT NULL,
    rfq_reference VARCHAR(64) NOT NULL UNIQUE,
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
    INDEX idx_status (status),
    INDEX idx_rfq_reference (rfq_reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RFQ Vendor Assignments (per-vendor contact tracking for n8n)
CREATE TABLE IF NOT EXISTS rfq_vendor_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT NOT NULL,
    vendor_id INT NOT NULL,
    contact_channel ENUM('email', 'whatsapp', 'telegram') NOT NULL,
    contact_id VARCHAR(64) NOT NULL,
    response_price DECIMAL(12,2),
    response_currency VARCHAR(3),
    responded_at TIMESTAMP NULL,
    status ENUM('pending', 'responded') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq_records(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    INDEX idx_rfq (rfq_id),
    INDEX idx_vendor (vendor_id),
    INDEX idx_contact (contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System Settings (single-row configuration)
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    master_logic_toggle ENUM('auto_send', 'low_confidence_only', 'manual_approval') NOT NULL DEFAULT 'manual_approval',
    default_currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
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

-- Unmatched Vendor Replies (for manual admin review when vendor reply cannot be auto-matched)
CREATE TABLE IF NOT EXISTS unmatched_vendor_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id VARCHAR(128) NOT NULL,
    contact_channel VARCHAR(32),
    reply_text TEXT NOT NULL,
    parsed_price DECIMAL(12,2),
    parsed_currency VARCHAR(3),
    status ENUM('unmatched', 'resolved', 'ignored') NOT NULL DEFAULT 'unmatched',
    matched_rfq_id INT,
    resolution_notes VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    INDEX idx_contact (contact_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer Messaging Windows (tracks 24h free-form reply windows for WhatsApp/Telegram)
CREATE TABLE IF NOT EXISTS customer_messaging_windows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id VARCHAR(128) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_contact_channel (contact_id, channel),
    INDEX idx_last_message (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Countries (dynamic country list for vendors and RFQs)
CREATE TABLE IF NOT EXISTS countries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(2) NOT NULL UNIQUE,
    name_en VARCHAR(64) NOT NULL,
    name_tr VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Postal Codes (prefix-based region mapping)
CREATE TABLE IF NOT EXISTS postal_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL,
    prefix VARCHAR(10) NOT NULL,
    region VARCHAR(64) NOT NULL,
    prefix_length INT NOT NULL DEFAULT 2,
    UNIQUE KEY uk_postal (country_code, prefix),
    INDEX idx_prefix (country_code, prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. SEED DATA
-- ============================================================

-- Default admin account (password: admin123)
-- bcrypt hash generated with bcryptjs (saltRounds: 10)
INSERT INTO admin_accounts (username, password_hash, display_name, is_active) VALUES
('admin', '$2b$10$/tCFPQo0Db6EM6uuWB55Ke1XgMzZQwR6Mf96p02T3kK2PTMOHfIUm', 'Test Administrator', TRUE)
ON DUPLICATE KEY UPDATE
    password_hash = VALUES(password_hash),
    display_name = VALUES(display_name),
    is_active = VALUES(is_active);

-- Countries
INSERT INTO countries (code, name_en, name_tr, is_active) VALUES
('TR', 'Turkey', 'Türkiye', TRUE),
('DE', 'Germany', 'Almanya', TRUE),
('RU', 'Russia', 'Rusya', TRUE),
('PL', 'Poland', 'Polonya', TRUE),
('EG', 'Egypt', 'Mısır', TRUE),
('UA', 'Ukraine', 'Ukrayna', TRUE),
('FR', 'France', 'Fransa', TRUE),
('IT', 'Italy', 'İtalya', TRUE),
('ES', 'Spain', 'İspanya', TRUE),
('NL', 'Netherlands', 'Hollanda', TRUE),
('BE', 'Belgium', 'Belçika', TRUE),
('AT', 'Austria', 'Avusturya', TRUE),
('RO', 'Romania', 'Romanya', TRUE),
('BG', 'Bulgaria', 'Bulgaristan', TRUE),
('GR', 'Greece', 'Yunanistan', TRUE),
('RS', 'Serbia', 'Sırbistan', TRUE),
('HU', 'Hungary', 'Macaristan', TRUE),
('CZ', 'Czech Republic', 'Çekya', TRUE),
('SK', 'Slovakia', 'Slovakya', TRUE),
('HR', 'Croatia', 'Hırvatistan', TRUE),
('SI', 'Slovenia', 'Slovenya', TRUE),
('BA', 'Bosnia', 'Bosna', TRUE),
('CH', 'Switzerland', 'İsviçre', TRUE),
('GB', 'United Kingdom', 'Birleşik Krallık', TRUE),
('PT', 'Portugal', 'Portekiz', TRUE),
('LT', 'Lithuania', 'Litvanya', TRUE),
('LV', 'Latvia', 'Letonya', TRUE),
('EE', 'Estonia', 'Estonya', TRUE),
('FI', 'Finland', 'Finlandiya', TRUE),
('SE', 'Sweden', 'İsveç', TRUE),
('NO', 'Norway', 'Norveç', TRUE),
('DK', 'Denmark', 'Danimarka', TRUE),
('MD', 'Moldova', 'Moldova', TRUE),
('AL', 'Albania', 'Arnavutluk', TRUE)
ON DUPLICATE KEY UPDATE name_en = VALUES(name_en), name_tr = VALUES(name_tr), is_active = VALUES(is_active);

-- Sample postal codes (European prefix mappings)
INSERT INTO postal_codes (country_code, prefix, region) VALUES
('DE', '10', 'DE-North'), ('DE', '11', 'DE-North'), ('DE', '20', 'DE-South'), ('DE', '21', 'DE-South'),
('SI', '10', 'SI-West'), ('SI', '11', 'SI-West'), ('SI', '20', 'SI-East'), ('SI', '21', 'SI-East'),
('HR', '10', 'HR-North'), ('HR', '11', 'HR-North'), ('HR', '20', 'HR-South'), ('HR', '21', 'HR-South'),
('BA', '10', 'BA-West'), ('BA', '11', 'BA-West'), ('BA', '20', 'BA-East'), ('BA', '21', 'BA-East'),
('AT', '10', 'AT-East'), ('AT', '11', 'AT-East'), ('AT', '20', 'AT-West'), ('AT', '21', 'AT-West'),
('CH', '10', 'CH-North'), ('CH', '11', 'CH-North'), ('CH', '20', 'CH-South'), ('CH', '21', 'CH-South')
ON DUPLICATE KEY UPDATE region = VALUES(region);

-- Sample route pricing (export/import tonnage-based)
INSERT INTO route_pricing (origin_region, destination_region, base_price, markup_percent, currency) VALUES
('DE-North', 'SI-West', 1500.00, 15.00, 'TRY'),
('DE-North', 'SI-East', 1600.00, 14.00, 'TRY'),
('DE-South', 'SI-West', 1700.00, 13.00, 'TRY'),
('DE-South', 'SI-East', 1800.00, 12.00, 'TRY'),
('DE-North', 'HR-North', 2000.00, 15.00, 'TRY'),
('DE-North', 'HR-South', 2100.00, 14.00, 'TRY'),
('AT-East', 'SI-West', 1200.00, 10.00, 'TRY'),
('CH-North', 'SI-East', 1400.00, 11.00, 'TRY')
ON DUPLICATE KEY UPDATE base_price = VALUES(base_price), markup_percent = VALUES(markup_percent);

-- Sample vendors with margin rates
INSERT INTO vendors (name, country_coverage, expertise_notes, priority_ranking, margin_rate, contact_email, contact_phone, is_active) VALUES
('BEKİRSAY Logistics', 'SI,HR,BA', 'Slovenia specialist, SI-20 route expert, Balkan coverage', 10, 5.00, 'contact@bekirsay.com', '+38612345678', TRUE),
('Global Freight Solutions', 'DE,AT,CH', 'Central Europe coverage, premium service', 20, 7.50, 'info@globalfreight.com', '+49123456789', TRUE),
('Balkan Express', 'HR,BA,RS', 'Balkan routes specialist, competitive pricing', 30, 3.00, 'ops@balkanexpress.com', '+38598765432', TRUE),
('EuroTrans GmbH', 'DE,AT,NL', 'North-south corridor expert', 40, 6.00, 'dispatch@eurotrans.de', '+49234567890', TRUE),
('Alpine Logistics', 'CH,AT,IT', 'Alpine region specialist, winter routes', 50, 4.50, 'alpine@logistics.ch', '+41791234567', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), country_coverage = VALUES(country_coverage);

-- Exchange rates (EUR/USD/GBP to TRY)
-- System settings (single row - master configuration)
INSERT INTO system_settings (master_logic_toggle, default_currency, oversize_weight_threshold_tons, waiting_period, global_markup_percent, vendor_msg_email, vendor_msg_telegram, vendor_msg_whatsapp, is_paused, rfq_send_mode) VALUES
('manual_approval', 'TRY', 22.00, '30m', 0.00, NULL, NULL, NULL, FALSE, 'auto')
ON DUPLICATE KEY UPDATE
    master_logic_toggle = VALUES(master_logic_toggle),
    default_currency = VALUES(default_currency),
    oversize_weight_threshold_tons = VALUES(oversize_weight_threshold_tons),
    waiting_period = VALUES(waiting_period),
    global_markup_percent = VALUES(global_markup_percent),
    vendor_msg_email = VALUES(vendor_msg_email),
    vendor_msg_telegram = VALUES(vendor_msg_telegram),
    vendor_msg_whatsapp = VALUES(vendor_msg_whatsapp),
    is_paused = VALUES(is_paused),
    rfq_send_mode = VALUES(rfq_send_mode);
