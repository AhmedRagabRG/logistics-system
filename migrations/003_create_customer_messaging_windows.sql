-- Migration: Create customer_messaging_windows table for WhatsApp 24h window tracking
CREATE TABLE IF NOT EXISTS customer_messaging_windows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id VARCHAR(128) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contact_channel (contact_id, channel),
    INDEX idx_channel (channel),
    INDEX idx_last_message (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
