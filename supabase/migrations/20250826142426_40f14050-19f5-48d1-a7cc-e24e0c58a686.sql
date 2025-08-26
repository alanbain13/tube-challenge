-- Final cleanup - remove all incorrect Nine Elms entries and keep only the correct one

-- Remove any Nine Elms entries that don't have the correct TfL ID
DELETE FROM stations 
WHERE (name ILIKE '%nine elms%' OR tfl_id = '9400ZZNEUGST' OR tfl_id = '940GZZNEUGST') 
  AND tfl_id != '940GZZLU990';

-- Ensure the correct entry exists with proper data
INSERT INTO stations (tfl_id, name, zone, lines, latitude, longitude)
SELECT '940GZZLU990', 'Nine Elms', '1', 
       ARRAY['Northern'::text], 
       51.48434, -0.12764
WHERE NOT EXISTS (
  SELECT 1 FROM stations WHERE tfl_id = '940GZZLU990'
)
ON CONFLICT (tfl_id) DO UPDATE SET
  name = EXCLUDED.name,
  zone = EXCLUDED.zone,
  lines = EXCLUDED.lines,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;