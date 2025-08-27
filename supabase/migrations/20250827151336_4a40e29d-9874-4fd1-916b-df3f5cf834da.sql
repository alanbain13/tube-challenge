-- Drop the old unique constraint that blocks same station across different activities
DROP INDEX IF EXISTS uniq_visits_user_tfl;

-- Create new unique constraint that allows same station across different activities
-- but prevents duplicates within the same activity
CREATE UNIQUE INDEX uniq_visits_user_activity_station
  ON public.station_visits (user_id, activity_id, station_tfl_id)
  WHERE station_tfl_id IS NOT NULL AND activity_id IS NOT NULL;