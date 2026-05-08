-- Add 'telegram' to contact_channel ENUM in rfq_vendor_assignments
ALTER TABLE rfq_vendor_assignments
  MODIFY COLUMN contact_channel ENUM('email', 'whatsapp', 'telegram') NOT NULL;
