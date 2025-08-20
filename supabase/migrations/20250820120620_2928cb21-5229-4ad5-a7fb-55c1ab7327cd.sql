-- Update station_visits table to allow proper verification methods
ALTER TABLE public.station_visits 
DROP CONSTRAINT IF EXISTS station_visits_verification_method_check;

-- Add new check constraint for verification methods
ALTER TABLE public.station_visits 
ADD CONSTRAINT station_visits_verification_method_check 
CHECK (verification_method IN ('gps', 'roundel_ai', 'manual'));

-- Add columns for better AI verification tracking
ALTER TABLE public.station_visits 
ADD COLUMN IF NOT EXISTS ai_station_text TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS visit_lat NUMERIC,
ADD COLUMN IF NOT EXISTS visit_lon NUMERIC;