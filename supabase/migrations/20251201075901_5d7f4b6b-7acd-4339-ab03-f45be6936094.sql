-- Add missing lines to the database
-- Note: Using NULL for metro_system_id initially, can be updated later with actual UUID
INSERT INTO lines (name, display_name, line_type, color, tfl_line_code, metro_system_id, is_active, sort_order)
VALUES 
  ('Crossrail 2', 'Crossrail 2 (future)', 'crossrail', '#0033A0', 'crossrail-2', NULL, false, 15),
  ('Thameslink', 'Thameslink', 'national_rail', '#8681BD', 'thameslink', NULL, true, 16)
ON CONFLICT (name) DO NOTHING;