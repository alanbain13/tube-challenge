-- Fix Nine Elms TfL ID and status enum alignment

-- 1. Fix Nine Elms TfL ID: should be 940GZZLUNEN (Northern line)
DELETE FROM stations WHERE tfl_id = '940GZZLU990';

INSERT INTO stations (tfl_id, name, zone, lines, latitude, longitude)
VALUES ('940GZZLUNEN', 'Nine Elms', '1', ARRAY['Northern'::text], 51.47991200, -0.12847600)
ON CONFLICT (tfl_id) DO UPDATE SET
  name = EXCLUDED.name,
  zone = EXCLUDED.zone, 
  lines = EXCLUDED.lines,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Update station_id_mapping for Nine Elms
INSERT INTO station_id_mapping (tfl_id, uuid_id)
SELECT '940GZZLUNEN', gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM station_id_mapping WHERE tfl_id = '940GZZLUNEN')
ON CONFLICT (tfl_id) DO NOTHING;

-- 2. Check and fix status enum - ensure 'verified' is allowed
-- First let's see what values are currently allowed, then we'll adjust if needed