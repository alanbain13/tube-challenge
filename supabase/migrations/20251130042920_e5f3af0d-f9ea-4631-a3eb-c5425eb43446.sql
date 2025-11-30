-- Step 4: Add CHECK constraint for display_name format
-- Enforces display name must be 2-50 characters, alphanumeric with spaces and common punctuation
ALTER TABLE public.profiles 
ADD CONSTRAINT display_name_format 
CHECK (
  display_name IS NULL OR (
    length(trim(display_name)) >= 2 
    AND length(trim(display_name)) <= 50
    AND display_name ~ '^[a-zA-Z0-9][a-zA-Z0-9 ._-]*$'
  )
);