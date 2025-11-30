-- Step 1: Drop UNIQUE constraint on username field
-- This allows multiple users to have the same real name
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;