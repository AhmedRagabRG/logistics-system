-- Add vendor message template columns to system_settings
ALTER TABLE system_settings
  ADD COLUMN vendor_msg_email TEXT,
  ADD COLUMN vendor_msg_telegram TEXT,
  ADD COLUMN vendor_msg_whatsapp TEXT;
