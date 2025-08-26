-- Fix Nine Elms station mapping to match stations.json dataset

-- First check if the entry exists
UPDATE stations 
SET tfl_id = '940GZZLU990'
WHERE name = 'Nine Elms Underground Station' AND tfl_id = '940GZZNEUGST';

-- If no rows were updated, insert the correct entry
INSERT INTO stations (tfl_id, name, zone, lines, latitude, longitude)
SELECT '940GZZLU990', 'Nine Elms', '1', 
       ARRAY['Northern'::text], 
       51.48434, -0.12764
WHERE NOT EXISTS (
  SELECT 1 FROM stations WHERE tfl_id = '940GZZLU990'
);

-- Add is_simulation column to station_visits to properly track simulation mode
ALTER TABLE station_visits 
ADD COLUMN IF NOT EXISTS is_simulation boolean DEFAULT false;