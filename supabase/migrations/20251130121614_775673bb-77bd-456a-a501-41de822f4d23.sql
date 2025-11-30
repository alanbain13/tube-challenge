-- Allow anyone to view public routes
CREATE POLICY "Public routes are viewable by everyone" 
ON routes FOR SELECT 
USING (is_public = true);

-- Allow anyone to view route stations for public routes
CREATE POLICY "Public route stations are viewable by everyone" 
ON route_stations FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM routes 
    WHERE routes.id = route_stations.route_id 
      AND routes.is_public = true
  )
);