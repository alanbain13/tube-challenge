-- Fix stale challenge_attempts where activity is completed but attempt is still 'active'
UPDATE challenge_attempts ca
SET 
  status = 'completed',
  is_personal_best = CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM challenge_attempts ca2 
      WHERE ca2.challenge_id = ca.challenge_id 
      AND ca2.user_id = ca.user_id 
      AND ca2.status = 'completed'
      AND ca2.id != ca.id
    ) THEN true 
    ELSE false 
  END
FROM activities a
WHERE a.challenge_attempt_id = ca.id
AND a.status = 'completed'
AND ca.status = 'active';