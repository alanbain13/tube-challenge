-- Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN username text UNIQUE;

-- Add constraint to ensure username is lowercase and alphanumeric with underscores/hyphens
ALTER TABLE public.profiles ADD CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_-]+$');

-- Create index for faster username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);