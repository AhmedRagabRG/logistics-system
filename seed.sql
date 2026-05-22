-- Seed reference data for development testing
-- Run: mysql -u root -p logistics_dashboard < seed.sql

-- Sample postal codes (European prefix mappings)
INSERT INTO postal_codes (country_code, prefix, region) VALUES
('DE', '10', 'DE-North'), ('DE', '11', 'DE-North'), ('DE', '20', 'DE-South'), ('DE', '21', 'DE-South'),
('SI', '10', 'SI-West'), ('SI', '11', 'SI-West'), ('SI', '20', 'SI-East'), ('SI', '21', 'SI-East'),
('HR', '10', 'HR-North'), ('HR', '11', 'HR-North'), ('HR', '20', 'HR-South'), ('HR', '21', 'HR-South'),
('BA', '10', 'BA-West'), ('BA', '11', 'BA-West'), ('BA', '20', 'BA-East'), ('BA', '21', 'BA-East'),
('AT', '10', 'AT-East'), ('AT', '11', 'AT-East'), ('AT', '20', 'AT-West'), ('AT', '21', 'AT-West'),
('CH', '10', 'CH-North'), ('CH', '11', 'CH-North'), ('CH', '20', 'CH-South'), ('CH', '21', 'CH-South')
ON DUPLICATE KEY UPDATE region = VALUES(region);

-- Sample route pricing
INSERT INTO route_pricing (origin_region, destination_region, base_price, markup_percent, currency) VALUES
('DE-North', 'SI-West', 1500.00, 15.00, 'TRY'),
('DE-North', 'SI-East', 1600.00, 14.00, 'TRY'),
('DE-South', 'SI-West', 1700.00, 13.00, 'TRY'),
('DE-South', 'SI-East', 1800.00, 12.00, 'TRY'),
('DE-North', 'HR-North', 2000.00, 15.00, 'TRY'),
('DE-North', 'HR-South', 2100.00, 14.00, 'TRY'),
('AT-East', 'SI-West', 1200.00, 10.00, 'TRY'),
('CH-North', 'SI-East', 1400.00, 11.00, 'TRY')
ON DUPLICATE KEY UPDATE base_price = VALUES(base_price), markup_percent = VALUES(markup_percent);

-- Sample vendors
INSERT INTO vendors (name, country_coverage, expertise_notes, priority_ranking, contact_email, contact_phone, is_active) VALUES
('BEKİRSAY Logistics', 'SI,HR,BA', 'Slovenia specialist, SI-20 route expert, Balkan coverage', 10, 'contact@bekirsay.com', '+38612345678', TRUE),
('Global Freight Solutions', 'DE,AT,CH', 'Central Europe coverage, premium service', 20, 'info@globalfreight.com', '+49123456789', TRUE),
('Balkan Express', 'HR,BA,RS', 'Balkan routes specialist, competitive pricing', 30, 'ops@balkanexpress.com', '+38598765432', TRUE),
('EuroTrans GmbH', 'DE,AT,NL', 'North-south corridor expert', 40, 'dispatch@eurotrans.de', '+49234567890', TRUE),
('Alpine Logistics', 'CH,AT,IT', 'Alpine region specialist, winter routes', 50, 'alpine@logistics.ch', '+41791234567', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), country_coverage = VALUES(country_coverage);

-- Exchange rates (EUR/USD to TRY)
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date) VALUES
('EUR', 'TRY', 35.50, '2026-04-28'),
('USD', 'TRY', 32.80, '2026-04-28'),
('GBP', 'TRY', 41.20, '2026-04-28')
ON DUPLICATE KEY UPDATE rate = VALUES(rate);

-- System settings (single row)
INSERT INTO system_settings (master_logic_toggle, default_currency, exchange_rate_reference_date, oversize_weight_threshold_tons, waiting_period, global_markup_percent, is_paused) VALUES
('manual_approval', 'TRY', '2026-04-28', 22.00, '30m', 0.00, FALSE);
