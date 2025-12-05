-- Update all challenges to have remote_verified as default verification level
UPDATE public.challenges 
SET required_verification = 'remote_verified'
WHERE required_verification IS NULL;