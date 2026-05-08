-- Redesign route_pricing: one row per route, with optional sea transport columns

-- Step 1: Add sea transport columns
ALTER TABLE route_pricing
  ADD COLUMN is_sea_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN sea_base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN sea_markup_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN sea_currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
  ADD INDEX idx_sea_active (is_sea_active);

-- Step 2: Copy sea-only row prices into the road row for the same route
UPDATE route_pricing road_row
JOIN route_pricing sea_row
  ON road_row.origin_region = sea_row.origin_region
  AND road_row.destination_region = sea_row.destination_region
  AND sea_row.transport_mode = 'sea'
SET road_row.is_sea_active = TRUE,
    road_row.sea_base_price = sea_row.base_price,
    road_row.sea_markup_percent = sea_row.markup_percent,
    road_row.sea_currency = sea_row.currency
WHERE road_row.transport_mode = 'road';

-- Step 3: Delete sea-only rows (merged into road rows)
DELETE FROM route_pricing WHERE transport_mode = 'sea';

-- Step 4: Drop transport_mode column and old composite index, restore unique constraint
ALTER TABLE route_pricing
  DROP COLUMN transport_mode,
  DROP INDEX uk_route_mode,
  DROP INDEX idx_transport_mode,
  ADD UNIQUE KEY uk_route (origin_region, destination_region);
