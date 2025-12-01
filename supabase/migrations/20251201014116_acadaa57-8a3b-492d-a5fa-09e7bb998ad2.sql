-- Add policy to allow authenticated users to view all profiles
-- This enables friend search functionality while maintaining security
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);