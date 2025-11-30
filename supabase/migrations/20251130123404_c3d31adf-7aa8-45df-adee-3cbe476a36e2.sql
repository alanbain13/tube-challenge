-- Create badges table to define all available badges
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  metro_system_id UUID REFERENCES public.metro_systems(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL DEFAULT 'challenge', -- 'challenge', 'milestone', 'achievement'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_badges junction table to track earned badges
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completion_time_minutes INTEGER,
  rank INTEGER,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for badges (everyone can view available badges)
CREATE POLICY "Badges are viewable by everyone" 
ON public.badges FOR SELECT 
USING (true);

-- RLS Policies for user_badges (users can only see their own earned badges)
CREATE POLICY "Users can view their own badges" 
ON public.user_badges FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges" 
ON public.user_badges FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_badges_updated_at
BEFORE UPDATE ON public.badges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed badges for existing challenges
INSERT INTO public.badges (name, description, image_url, challenge_id, metro_system_id, badge_type)
SELECT 
  CASE 
    WHEN c.name ILIKE '%Complete All Lines%' THEN 'London Legend'
    WHEN c.name ILIKE '%Circle%' THEN 'Circle Line Champion'
    ELSE c.name || ' Master'
  END as name,
  CASE 
    WHEN c.name ILIKE '%Complete All Lines%' THEN 'Completed all London Underground stations'
    WHEN c.name ILIKE '%Circle%' THEN 'Completed the Circle Line challenge'
    ELSE 'Completed the ' || c.name
  END as description,
  CASE 
    WHEN c.name ILIKE '%Complete All Lines%' THEN '🏆'
    WHEN c.name ILIKE '%Circle%' THEN '🥇'
    ELSE '🏅'
  END as image_url,
  c.id as challenge_id,
  c.metro_system_id,
  'challenge' as badge_type
FROM public.challenges c
WHERE c.is_official = true
ON CONFLICT DO NOTHING;