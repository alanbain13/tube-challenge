-- Fix status enum to include 'verified' as expected by the application
ALTER TABLE station_visits DROP CONSTRAINT station_visits_status_check;
ALTER TABLE station_visits ADD CONSTRAINT station_visits_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'visited'::text, 'verified'::text]));

-- Also clean up verification_method constraints - we have duplicates
ALTER TABLE station_visits DROP CONSTRAINT station_visits_verification_method_check;
-- Keep the more complete check_verification_method constraint that includes 'ai_image'