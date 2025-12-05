-- Backfill verification_level for completed activities that have NULL
-- Uses "weakest link" model: activity level = lowest (most permissive) of all visits

UPDATE activities a
SET verification_level = (
  SELECT 
    CASE 
      -- If any visit is remote_verified, pending, or null -> remote_verified
      WHEN EXISTS (
        SELECT 1 FROM station_visits sv 
        WHERE sv.activity_id = a.id 
        AND sv.status = 'verified'
        AND (sv.verification_status IS NULL 
             OR sv.verification_status = 'remote_verified' 
             OR sv.verification_status = 'pending')
      ) THEN 'remote_verified'
      -- If any visit is photo_verified (and none remote) -> photo_verified
      WHEN EXISTS (
        SELECT 1 FROM station_visits sv 
        WHERE sv.activity_id = a.id 
        AND sv.status = 'verified'
        AND sv.verification_status = 'photo_verified'
      ) THEN 'photo_verified'
      -- If all visits are location_verified -> location_verified
      WHEN EXISTS (
        SELECT 1 FROM station_visits sv 
        WHERE sv.activity_id = a.id 
        AND sv.status = 'verified'
      ) AND NOT EXISTS (
        SELECT 1 FROM station_visits sv 
        WHERE sv.activity_id = a.id 
        AND sv.status = 'verified'
        AND (sv.verification_status IS NULL 
             OR sv.verification_status != 'location_verified')
      ) THEN 'location_verified'
      -- Default to remote_verified
      ELSE 'remote_verified'
    END
)
WHERE a.status = 'completed' 
AND a.verification_level IS NULL;

-- Also update station visits that have 'pending' verification_status to 'remote_verified'
-- for completed activities (they should have been verified at completion time)
UPDATE station_visits sv
SET verification_status = 'remote_verified'
WHERE sv.status = 'verified'
AND sv.verification_status = 'pending'
AND EXISTS (
  SELECT 1 FROM activities a 
  WHERE a.id = sv.activity_id 
  AND a.status = 'completed'
);