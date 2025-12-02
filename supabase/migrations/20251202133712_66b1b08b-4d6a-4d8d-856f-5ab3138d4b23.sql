-- Phase 1: Enhance challenges system for 5 challenge types

-- 1. Add new columns to challenges table
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS is_sequenced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS start_station_tfl_id text,
ADD COLUMN IF NOT EXISTS end_station_tfl_id text,
ADD COLUMN IF NOT EXISTS time_limit_seconds integer,
ADD COLUMN IF NOT EXISTS target_station_count integer,
ADD COLUMN IF NOT EXISTS ranking_metric text DEFAULT 'time';

-- Add comment for challenge_type values
COMMENT ON COLUMN public.challenges.challenge_type IS 'One of: sequenced_route, unsequenced_route, timed, station_count, point_to_point';
COMMENT ON COLUMN public.challenges.ranking_metric IS 'One of: time (lower is better), station_count (higher is better)';

-- 2. Enhance challenge_attempts table
ALTER TABLE public.challenge_attempts
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS duration_seconds integer,
ADD COLUMN IF NOT EXISTS stations_visited integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_personal_best boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS failure_reason text;

COMMENT ON COLUMN public.challenge_attempts.status IS 'One of: active, completed, failed, abandoned, timeout';

-- 3. Link activities to challenges
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS challenge_id uuid REFERENCES public.challenges(id),
ADD COLUMN IF NOT EXISTS challenge_attempt_id uuid REFERENCES public.challenge_attempts(id),
ADD COLUMN IF NOT EXISTS challenge_deadline timestamp with time zone,
ADD COLUMN IF NOT EXISTS challenge_target_station_count integer;

-- Create index for faster challenge queries
CREATE INDEX IF NOT EXISTS idx_activities_challenge_id ON public.activities(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_status ON public.challenge_attempts(status);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge_user ON public.challenge_attempts(challenge_id, user_id);