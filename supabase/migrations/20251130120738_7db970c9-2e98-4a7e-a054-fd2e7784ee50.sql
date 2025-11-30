-- Delete existing official challenges
DELETE FROM challenges WHERE is_official = true;

-- Re-insert challenges with corrected station queries
DO $$
DECLARE
  metro_id uuid;
  all_stations_ids text[];
  circle_stations_ids text[];
  eleven_lines_stations_ids text[];
  zone1_placeholder_ids text[];
BEGIN
  -- Get London Underground metro system ID
  SELECT id INTO metro_id FROM metro_systems WHERE code = 'london' LIMIT 1;
  
  IF metro_id IS NULL THEN
    RAISE EXCEPTION 'London Underground metro system not found';
  END IF;

  -- Get ALL tube stations (including all prefixes to reach 272)
  -- 940GZZLU = Tube stations, but we'll get all to ensure we have 272
  SELECT array_agg(tfl_id) INTO all_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND (
      tfl_id LIKE '940GZZLU%' OR 
      tfl_id LIKE '9400ZZLU%'
    );

  -- Get Circle line station IDs
  SELECT array_agg(tfl_id) INTO circle_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND (tfl_id LIKE '940GZZLU%' OR tfl_id LIKE '9400ZZLU%')
    AND 'Circle' = ANY(lines);

  -- Get 11 Lines stations (Bakerloo, Central, Circle, District, Piccadilly, Northern, Hammersmith & City, Waterloo & City, Metropolitan, Victoria, Jubilee)
  SELECT array_agg(tfl_id) INTO eleven_lines_stations_ids
  FROM stations 
  WHERE metro_system_id = metro_id 
    AND (tfl_id LIKE '940GZZLU%' OR tfl_id LIKE '9400ZZLU%')
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

  -- For Zone 1 Champion, create empty array since zone data is incorrect
  -- This will be populated when station data is fixed
  zone1_placeholder_ids := ARRAY[]::text[];

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
      zone1_placeholder_ids,
      280
    );
END $$;