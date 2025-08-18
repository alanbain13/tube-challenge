-- Add new columns to activities table for enhanced start functionality
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed'));

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS start_station_tfl_id text;

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS end_station_tfl_id text;

-- Create index for performance on status filtering
CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities(status);

-- Create index for performance on start/end station lookups
CREATE INDEX IF NOT EXISTS idx_activities_start_station ON public.activities(start_station_tfl_id);
CREATE INDEX IF NOT EXISTS idx_activities_end_station ON public.activities(end_station_tfl_id);