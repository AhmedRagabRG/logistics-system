-- Add quote_id and rfq_id columns to system_logs for linking events to quotes/RFQs
ALTER TABLE system_logs
  ADD COLUMN quote_id INT NULL AFTER admin_id,
  ADD COLUMN rfq_id INT NULL AFTER quote_id,
  ADD INDEX idx_quote_id (quote_id),
  ADD INDEX idx_rfq_id (rfq_id);
