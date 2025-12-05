-- Allow friends to view station visits (roundel photos) on completed activities
CREATE POLICY "Users can view station visits on friends' completed activities" 
ON public.station_visits 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM activities
    WHERE activities.id = station_visits.activity_id 
      AND activities.status = 'completed'
      AND are_friends(activities.user_id, auth.uid())
  )
);