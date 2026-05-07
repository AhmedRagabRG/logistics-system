-- Add telegram_chat_id to vendors
ALTER TABLE vendors
  ADD COLUMN telegram_chat_id VARCHAR(64) AFTER contact_phone;
