-- Migration: Add selected_vendor_id to rfq_records to track manually/auto-selected vendor
ALTER TABLE rfq_records ADD COLUMN selected_vendor_id INT NULL AFTER generated_quote_price;
ALTER TABLE rfq_records ADD FOREIGN KEY (selected_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
