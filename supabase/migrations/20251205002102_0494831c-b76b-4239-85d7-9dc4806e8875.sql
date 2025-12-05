-- Update all badges to have remote_verified as default verification level
UPDATE public.badges 
SET criteria = COALESCE(criteria, '{}'::jsonb) || '{"required_verification": "remote_verified"}'::jsonb
WHERE criteria IS NULL OR NOT (criteria ? 'required_verification');