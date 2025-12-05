-- Drop existing policy
DROP POLICY IF EXISTS "Users can update their own challenges" ON challenges;

-- Create updated policy that allows:
-- 1. Users to update their own challenges (created_by_user_id = auth.uid())
-- 2. Admins to update official challenges (is_official = true)
CREATE POLICY "Users can update their own challenges or admins can update official" 
ON challenges 
FOR UPDATE 
USING (
  (auth.uid() = created_by_user_id) 
  OR 
  (is_official = true AND has_role(auth.uid(), 'admin'::app_role))
);

-- Also update delete policy for consistency
DROP POLICY IF EXISTS "Users can delete their own challenges" ON challenges;

CREATE POLICY "Users can delete their own challenges or admins can delete official" 
ON challenges 
FOR DELETE 
USING (
  (auth.uid() = created_by_user_id) 
  OR 
  (is_official = true AND has_role(auth.uid(), 'admin'::app_role))
);