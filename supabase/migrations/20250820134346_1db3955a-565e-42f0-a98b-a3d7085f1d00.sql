-- Ensure verification_method column supports ai_image value
ALTER TABLE public.station_visits 
ADD CONSTRAINT check_verification_method 
CHECK (verification_method IN ('gps', 'manual', 'pending', 'ai_image', 'roundel_ai'));