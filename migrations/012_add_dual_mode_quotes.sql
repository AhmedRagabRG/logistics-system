-- Add sea pricing columns to quotes for dual-mode (road + sea) display
ALTER TABLE quotes
  ADD COLUMN sea_base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER currency,
  ADD COLUMN sea_markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER sea_base_price,
  ADD COLUMN sea_final_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER sea_markup_percent,
  ADD COLUMN sea_currency VARCHAR(3) NOT NULL DEFAULT 'TRY' AFTER sea_final_price,
  ADD COLUMN is_dual_mode BOOLEAN NOT NULL DEFAULT FALSE AFTER sea_currency;
