-- Add 'simulation' to allowed verification_method values
ALTER TABLE public.station_visits 
DROP CONSTRAINT IF EXISTS check_verification_method;

ALTER TABLE public.station_visits 
ADD CONSTRAINT check_verification_method 
CHECK (verification_method IN ('gps', 'manual', 'pending', 'ai_image', 'roundel_ai', 'simulation'));