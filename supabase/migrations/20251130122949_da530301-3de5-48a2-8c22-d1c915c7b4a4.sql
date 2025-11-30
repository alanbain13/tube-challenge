-- Create sample achievements for demo purposes
-- First, get the user_id and challenge_ids we need
DO $$
DECLARE
  demo_user_id uuid;
  complete_all_lines_id uuid;
  circle_line_id uuid;
BEGIN
  -- Get a user (first authenticated user)
  SELECT user_id INTO demo_user_id FROM profiles LIMIT 1;
  
  -- Get challenge IDs
  SELECT id INTO complete_all_lines_id FROM challenges WHERE name ILIKE '%Complete All Lines%' LIMIT 1;
  SELECT id INTO circle_line_id FROM challenges WHERE name ILIKE '%Circle Line%' LIMIT 1;
  
  -- Only insert if we have a user
  IF demo_user_id IS NOT NULL THEN
    -- Insert sample achievements
    INSERT INTO achievements (user_id, name, key, type, meta, earned_at)
    VALUES 
      (demo_user_id, 'London Legend', 'complete_all_lines', 'challenge_complete', 
       jsonb_build_object('challenge_id', complete_all_lines_id), NOW() - INTERVAL '7 days'),
      (demo_user_id, 'Circle Line Champion', 'circle_line_complete', 'challenge_complete', 
       jsonb_build_object('challenge_id', circle_line_id), NOW() - INTERVAL '3 days'),
      (demo_user_id, 'Speed Demon', 'speed_record', 'speed_record', 
       jsonb_build_object('challenge_id', circle_line_id), NOW() - INTERVAL '1 day'),
      (demo_user_id, 'First Timer', 'first_challenge', 'milestone', 
       jsonb_build_object('challenge_id', complete_all_lines_id), NOW() - INTERVAL '10 days')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;