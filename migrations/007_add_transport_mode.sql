-- Add transport_mode to route_pricing
ALTER TABLE route_pricing
  ADD COLUMN transport_mode ENUM('road', 'sea') NOT NULL DEFAULT 'road',
  DROP INDEX uk_route,
  ADD UNIQUE KEY uk_route_mode (origin_region, destination_region, transport_mode),
  ADD INDEX idx_transport_mode (transport_mode);

-- Add transport_mode to quotes
ALTER TABLE quotes
  ADD COLUMN transport_mode ENUM('road', 'sea') NOT NULL DEFAULT 'road',
  ADD INDEX idx_transport_mode (transport_mode);
