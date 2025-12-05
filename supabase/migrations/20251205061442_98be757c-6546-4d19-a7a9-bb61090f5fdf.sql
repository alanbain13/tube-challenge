-- Update challenges RLS to allow viewing friend-created challenges
DROP POLICY IF EXISTS "Challenges are viewable by everyone" ON challenges;

CREATE POLICY "Challenges are viewable by everyone or created by friends" ON challenges
FOR SELECT USING (
  is_official = true 
  OR created_by_user_id = auth.uid()
  OR are_friends(created_by_user_id, auth.uid())
);

-- Add RLS policy for routes to allow friends to view shared routes
DROP POLICY IF EXISTS "Users can view friends' shared routes" ON routes;

CREATE POLICY "Users can view friends' shared routes" ON routes
FOR SELECT USING (
  user_id = auth.uid() 
  OR (is_public = true AND are_friends(user_id, auth.uid()))
);

-- Update existing public routes policy to coexist
DROP POLICY IF EXISTS "Public routes are viewable by everyone" ON routes;