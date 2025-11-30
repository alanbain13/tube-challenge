-- Get metro system ID for London Underground
DO $$
DECLARE
  metro_id uuid;
  all_stations_ids text[];
  circle_stations_ids text[];
  eleven_lines_stations_ids text[];
  zone1_stations_ids text[];
BEGIN
  -- Get London Underground metro system ID
  SELECT id INTO metro_id FROM metro_systems WHERE code = 'london' LIMIT 1;
  
  IF metro_id IS NULL THEN
    RAISE EXCEPTION 'London Underground metro system not found';
  END IF;

  -- Get all tube station IDs (940GZZLU prefix indicates tube stations)
  SELECT array_agg(tfl_id) INTO all_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND tfl_id LIKE '940GZZLU%';

  -- Get Circle line station IDs
  SELECT array_agg(tfl_id) INTO circle_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND tfl_id LIKE '940GZZLU%'
    AND 'Circle' = ANY(lines);

  -- Get 11 Lines stations (Bakerloo, Central, Circle, District, Piccadilly, Northern, Hammersmith & City, Waterloo & City, Metropolitan, Victoria, Jubilee)
  SELECT array_agg(tfl_id) INTO eleven_lines_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND tfl_id LIKE '940GZZLU%'
    AND (
      'Bakerloo' = ANY(lines) OR
      'Central' = ANY(lines) OR
      'Circle' = ANY(lines) OR
      'District' = ANY(lines) OR
      'Piccadilly' = ANY(lines) OR
      'Northern' = ANY(lines) OR
      'Hammersmith & City' = ANY(lines) OR
      'Waterloo & City' = ANY(lines) OR
      'Metropolitan' = ANY(lines) OR
      'Victoria' = ANY(lines) OR
      'Jubilee' = ANY(lines)
    );

  -- Get Zone 1 stations on the 11 lines (Note: zone data may be incorrect)
  SELECT array_agg(tfl_id) INTO zone1_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND tfl_id LIKE '940GZZLU%'
    AND zone = '1'
    AND (
      'Bakerloo' = ANY(lines) OR
      'Central' = ANY(lines) OR
      'Circle' = ANY(lines) OR
      'District' = ANY(lines) OR
      'Piccadilly' = ANY(lines) OR
      'Northern' = ANY(lines) OR
      'Hammersmith & City' = ANY(lines) OR
      'Waterloo & City' = ANY(lines) OR
      'Metropolitan' = ANY(lines) OR
      'Victoria' = ANY(lines) OR
      'Jubilee' = ANY(lines)
    );

  -- Insert official challenges
  INSERT INTO challenges (name, description, metro_system_id, challenge_type, is_official, created_by_user_id, station_tfl_ids, estimated_duration_minutes)
  VALUES
    (
      'Complete All Lines',
      'Visit every single station on the London Underground network',
      metro_id,
      'All Stations',
      true,
      NULL,
      all_stations_ids,
      1200
    ),
    (
      'Circle Line Challenge',
      'Complete the iconic Circle Line loop around central London',
      metro_id,
      'Single Line',
      true,
      NULL,
      circle_stations_ids,
      107
    ),
    (
      '11 Lines Legend',
      'Master all stations across the 11 major tube lines',
      metro_id,
      'Multi-Line',
      true,
      NULL,
      eleven_lines_stations_ids,
      1050
    ),
    (
      'Zone 1 Champion',
      'Conquer all stations in Central London (Zone 1)',
      metro_id,
      'Zone Challenge',
      true,
      NULL,
      zone1_stations_ids,
      280
    );
END $$;

-- Update RLS policy to allow official challenges to be inserted without user_id
DROP POLICY IF EXISTS "Users can create challenges from their routes" ON challenges;

CREATE POLICY "Users can create challenges from their routes" 
ON challenges FOR INSERT 
WITH CHECK (
  (is_official = true AND created_by_user_id IS NULL) 
  OR 
  (auth.uid() = created_by_user_id AND (
    (created_from_route_id IS NULL) OR 
    (EXISTS (
      SELECT 1 FROM routes 
      WHERE routes.id = challenges.created_from_route_id 
        AND routes.user_id = auth.uid()
    ))
  ))
);