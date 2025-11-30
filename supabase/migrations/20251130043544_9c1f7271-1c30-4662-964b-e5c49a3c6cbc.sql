-- Change 5: Update existing data and add CHECK constraint for username format

-- First, update any existing usernames that contain invalid characters
-- Remove any non-letter, non-space characters
UPDATE public.profiles 
SET username = regexp_replace(username, '[^a-zA-Z ]', '', 'g')
WHERE username IS NOT NULL 
  AND username !~ '^[a-zA-Z ]+$';

-- Add CHECK constraint for username format (letters and spaces only)
ALTER TABLE public.profiles 
ADD CONSTRAINT username_format 
CHECK (
  username IS NULL OR (
    length(trim(username)) >= 2 
    AND length(trim(username)) <= 50
    AND username ~ '^[a-zA-Z ]+$'
  )
);