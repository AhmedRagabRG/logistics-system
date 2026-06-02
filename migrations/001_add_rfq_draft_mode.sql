-- ============================================================================
-- Migration: Add RFQ draft mode + missing system_settings columns
-- Run this directly on your live MySQL database via phpMyAdmin, MySQL CLI, etc.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RFQ RECORDS: Add 'draft' to status ENUM + messages_sent column
-- ---------------------------------------------------------------------------
ALTER TABLE rfq_records
MODIFY COLUMN status ENUM('draft', 'open', 'responded', 'closed') NOT NULL DEFAULT 'draft';

ALTER TABLE rfq_records
ADD COLUMN IF NOT EXISTS messages_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2. SYSTEM SETTINGS: Add rfq_send_mode + other missing columns
-- ---------------------------------------------------------------------------
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS rfq_send_mode ENUM('auto','manual') NOT NULL DEFAULT 'auto';

ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS waiting_period VARCHAR(16) NOT NULL DEFAULT '30m';

ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS global_markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00;

ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS vendor_msg_email TEXT;

ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS vendor_msg_telegram TEXT;

ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS vendor_msg_whatsapp TEXT;

ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 3. VERIFY: Run these to confirm everything looks good
-- ---------------------------------------------------------------------------
-- SHOW COLUMNS FROM rfq_records;
-- SHOW COLUMNS FROM system_settings;
