CREATE TABLE IF NOT EXISTS unmatched_vendor_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_id VARCHAR(128) NOT NULL,
  contact_channel VARCHAR(32) DEFAULT NULL,
  reply_text TEXT NOT NULL,
  parsed_price DECIMAL(12,2) DEFAULT NULL,
  parsed_currency VARCHAR(3) DEFAULT NULL,
  status ENUM('unmatched','resolved','ignored') NOT NULL DEFAULT 'unmatched',
  matched_rfq_id INT DEFAULT NULL,
  resolution_notes VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_status (status),
  INDEX idx_contact_id (contact_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
