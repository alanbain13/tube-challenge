-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Challenge attempts are viewable by everyone" ON public.challenge_attempts;

-- Create policy for users to view their own challenge attempts
CREATE POLICY "Users can view their own challenge attempts" 
ON public.challenge_attempts 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy for users to view friends' challenge attempts
CREATE POLICY "Users can view friends' challenge attempts" 
ON public.challenge_attempts 
FOR SELECT 
USING (are_friends(user_id, auth.uid()));