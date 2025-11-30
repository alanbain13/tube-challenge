-- Step 3: Add UNIQUE constraint on display_name
-- This ensures display names are unique across all users
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_display_name_key UNIQUE (display_name);