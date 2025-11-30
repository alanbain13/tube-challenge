-- Delete and recreate challenges with correct tube station filter
DELETE FROM challenges WHERE is_official = true;

DO $$
DECLARE
  metro_id uuid;
  all_stations_ids text[];
  circle_stations_ids text[];
  eleven_lines_stations_ids text[];
BEGIN
  SELECT id INTO metro_id FROM metro_systems WHERE code = 'london' LIMIT 1;

  -- Get tube stations only (940GZZLU prefix)
  SELECT array_agg(tfl_id) INTO all_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND tfl_id LIKE '940GZZLU%';

  -- Get Circle line stations
  SELECT array_agg(tfl_id) INTO circle_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND tfl_id LIKE '940GZZLU%'
    AND 'Circle' = ANY(lines);

  -- Get 11 major lines stations
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

  INSERT INTO challenges (name, description, metro_system_id, challenge_type, is_official, created_by_user_id, station_tfl_ids, estimated_duration_minutes)
  VALUES
    (
      'Complete All Lines',
      'Visit every single station on the London Underground network (272 stations)',
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
      'Conquer all 67 stations in Central London (Zone 1)',
      metro_id,
      'Zone Challenge',
      true,
      NULL,
      ARRAY[]::text[],
      280
    );
END $$;