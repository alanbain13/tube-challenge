-- =============================================
-- Phase 1: Verification System Schema Changes
-- =============================================

-- 1. Create app_settings table for admin-configurable values
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('GPS_RADIUS_METERS', '750', 'Geofence radius in meters for location verification'),
  ('PHOTO_MAX_AGE_SECONDS', '600', 'Maximum seconds between photo capture and upload for location/photo verification');

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Settings are viewable by everyone" 
ON public.app_settings FOR SELECT 
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update settings" 
ON public.app_settings FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings" 
ON public.app_settings FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Only admins can delete settings
CREATE POLICY "Admins can delete settings" 
ON public.app_settings FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- 2. Add new columns to station_visits table
-- Verification status classification
ALTER TABLE public.station_visits 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
-- Values: 'location_verified', 'photo_verified', 'remote_verified', 'pending', 'failed'

-- Load timestamp (when photo was uploaded to the app)
ALTER TABLE public.station_visits 
ADD COLUMN IF NOT EXISTS loaded_at TIMESTAMPTZ;

-- Device GPS coordinates at load time
ALTER TABLE public.station_visits 
ADD COLUMN IF NOT EXISTS load_lat NUMERIC;

ALTER TABLE public.station_visits 
ADD COLUMN IF NOT EXISTS load_lon NUMERIC;

-- Time difference between EXIF capture and load (for auditing)
ALTER TABLE public.station_visits 
ADD COLUMN IF NOT EXISTS time_diff_seconds INTEGER;

-- Cumulative duration from activity start (gate_start_at)
ALTER TABLE public.station_visits 
ADD COLUMN IF NOT EXISTS cumulative_duration_seconds INTEGER;

-- 3. Add verification_level to activities table (calculated at completion)
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS verification_level TEXT;
-- Values: 'location_verified', 'photo_verified', 'remote_verified', 'failed', NULL (not yet completed)

-- 4. Add required_verification to challenges table
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS required_verification TEXT DEFAULT 'remote_verified';
-- Values: 'location_verified' (strictest), 'photo_verified', 'remote_verified' (most lenient)

-- Update existing challenges to use remote_verified (most lenient) for backward compatibility
UPDATE public.challenges 
SET required_verification = 'remote_verified' 
WHERE required_verification IS NULL;

-- 5. Create index for efficient verification status queries
CREATE INDEX IF NOT EXISTS idx_station_visits_verification_status 
ON public.station_visits(verification_status);

CREATE INDEX IF NOT EXISTS idx_station_visits_activity_verification 
ON public.station_visits(activity_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_activities_verification_level 
ON public.activities(verification_level);