-- Step 2: Drop CHECK constraint on username field
-- This removes format validation on username
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS username_format;