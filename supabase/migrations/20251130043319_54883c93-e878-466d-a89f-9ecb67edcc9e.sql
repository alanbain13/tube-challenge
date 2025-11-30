-- Fix Change 4: Update existing data and correct display_name CHECK constraint format

-- First, update any existing display names that contain invalid characters
-- Replace spaces with underscores to comply with the new format
UPDATE public.profiles 
SET display_name = regexp_replace(display_name, '[^a-zA-Z0-9_-]', '_', 'g')
WHERE display_name IS NOT NULL 
  AND display_name !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]*$';

-- Drop the incorrect constraint that allowed spaces and periods
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS display_name_format;

-- Add the corrected constraint (only letters, numbers, dashes, underscores)
ALTER TABLE public.profiles 
ADD CONSTRAINT display_name_format 
CHECK (
  display_name IS NULL OR (
    length(trim(display_name)) >= 2 
    AND length(trim(display_name)) <= 50
    AND display_name ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]*$'
  )
);