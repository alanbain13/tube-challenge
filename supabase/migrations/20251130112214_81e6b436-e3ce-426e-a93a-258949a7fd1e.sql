-- Add metro_system_id to routes table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'routes' AND column_name = 'metro_system_id'
  ) THEN
    ALTER TABLE public.routes ADD COLUMN metro_system_id uuid REFERENCES public.metro_systems(id);
  END IF;
END $$;

-- Update existing routes to belong to London Underground
UPDATE public.routes
SET metro_system_id = (
  SELECT id FROM public.metro_systems WHERE code = 'london-underground' LIMIT 1
)
WHERE metro_system_id IS NULL;

-- Create challenges table (if not exists)
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  metro_system_id uuid REFERENCES public.metro_systems(id) NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id),
  created_from_route_id uuid REFERENCES public.routes(id),
  station_tfl_ids text[] NOT NULL,
  challenge_type text NOT NULL,
  is_official boolean NOT NULL DEFAULT false,
  difficulty text,
  estimated_duration_minutes integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on challenges
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Challenges are viewable by everyone" ON public.challenges;
DROP POLICY IF EXISTS "Users can create challenges from their routes" ON public.challenges;
DROP POLICY IF EXISTS "Users can update their own challenges" ON public.challenges;
DROP POLICY IF EXISTS "Users can delete their own challenges" ON public.challenges;

-- RLS policies for challenges
CREATE POLICY "Challenges are viewable by everyone"
ON public.challenges
FOR SELECT
USING (true);

CREATE POLICY "Users can create challenges from their routes"
ON public.challenges
FOR INSERT
WITH CHECK (
  auth.uid() = created_by_user_id
  AND (created_from_route_id IS NULL OR EXISTS (
    SELECT 1 FROM routes WHERE id = created_from_route_id AND user_id = auth.uid()
  ))
);

CREATE POLICY "Users can update their own challenges"
ON public.challenges
FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own challenges"
ON public.challenges
FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Create challenge_attempts table (leaderboard)
CREATE TABLE IF NOT EXISTS public.challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
  completed_at timestamp with time zone NOT NULL,
  duration_minutes integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on challenge_attempts
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Challenge attempts are viewable by everyone" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Users can create their own challenge attempts" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Users can update their own challenge attempts" ON public.challenge_attempts;
DROP POLICY IF EXISTS "Users can delete their own challenge attempts" ON public.challenge_attempts;

-- RLS policies for challenge_attempts
CREATE POLICY "Challenge attempts are viewable by everyone"
ON public.challenge_attempts
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own challenge attempts"
ON public.challenge_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenge attempts"
ON public.challenge_attempts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenge attempts"
ON public.challenge_attempts
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for challenges updated_at (drop if exists first)
DROP TRIGGER IF EXISTS update_challenges_updated_at ON public.challenges;
CREATE TRIGGER update_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();