-- Allow visits to be recorded using either station UUID or TfL ID
ALTER TABLE public.station_visits
  ALTER COLUMN station_id DROP NOT NULL;

-- Ensure at least one identifier is present (UUID or TfL ID)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'station_visits_station_or_tfl_required'
      AND table_name = 'station_visits'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.station_visits
      ADD CONSTRAINT station_visits_station_or_tfl_required
      CHECK (station_id IS NOT NULL OR station_tfl_id IS NOT NULL);
  END IF;
END $$;