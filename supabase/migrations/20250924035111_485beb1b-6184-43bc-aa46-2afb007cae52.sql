-- Add A3 metadata fields to station_visits table
-- These fields provide richer check-in metadata for enhanced validation and user experience

ALTER TABLE public.station_visits 
ADD COLUMN captured_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN thumb_url TEXT,
ADD COLUMN seq_actual INTEGER,
ADD COLUMN gps_source TEXT DEFAULT 'device',
ADD COLUMN geofence_distance_m NUMERIC,
ADD COLUMN exif_time_present BOOLEAN DEFAULT false,
ADD COLUMN exif_gps_present BOOLEAN DEFAULT false,
ADD COLUMN pending_reason TEXT,
ADD COLUMN verifier_version TEXT DEFAULT '1.0';

-- Add comments to document the fields and fallback logic
COMMENT ON COLUMN public.station_visits.captured_at IS 'Actual timestamp when photo was captured (from EXIF if available, falls back to visited_at)';
COMMENT ON COLUMN public.station_visits.thumb_url IS 'URL to thumbnail version of verification photo for fast loading';
COMMENT ON COLUMN public.station_visits.seq_actual IS 'Actual sequence number in chronological visit order (may differ from planned sequence)';
COMMENT ON COLUMN public.station_visits.gps_source IS 'Source of GPS coordinates: device, exif, manual, or estimated';
COMMENT ON COLUMN public.station_visits.geofence_distance_m IS 'Distance in meters from expected station location for geofence validation';
COMMENT ON COLUMN public.station_visits.exif_time_present IS 'Whether EXIF timestamp data was found in uploaded photo';
COMMENT ON COLUMN public.station_visits.exif_gps_present IS 'Whether EXIF GPS coordinates were found in uploaded photo';
COMMENT ON COLUMN public.station_visits.pending_reason IS 'Reason why visit is in pending status: ocr_failed, geofence_failed, offline, manual_review, etc.';
COMMENT ON COLUMN public.station_visits.verifier_version IS 'Version of the verification system that processed this visit';

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_station_visits_captured_at ON public.station_visits(captured_at);
CREATE INDEX IF NOT EXISTS idx_station_visits_seq_actual ON public.station_visits(seq_actual);
CREATE INDEX IF NOT EXISTS idx_station_visits_pending_reason ON public.station_visits(pending_reason) WHERE pending_reason IS NOT NULL;