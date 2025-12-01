-- Create helper function to check if two users are friends
CREATE OR REPLACE FUNCTION public.are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND ((user_id_1 = user_a AND user_id_2 = user_b) OR (user_id_1 = user_b AND user_id_2 = user_a))
  );
$$;

-- Create activity_likes table
CREATE TABLE public.activity_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

-- Enable RLS on activity_likes
ALTER TABLE public.activity_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_likes
CREATE POLICY "Users can view likes on their own activities"
ON public.activity_likes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_likes.activity_id
    AND activities.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view likes on friends' completed activities"
ON public.activity_likes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_likes.activity_id
    AND activities.status = 'completed'
    AND public.are_friends(activities.user_id, auth.uid())
  )
);

CREATE POLICY "Users can like friends' completed activities"
ON public.activity_likes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_likes.activity_id
    AND activities.status = 'completed'
    AND (activities.user_id = auth.uid() OR public.are_friends(activities.user_id, auth.uid()))
  )
);

CREATE POLICY "Users can remove their own likes"
ON public.activity_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Create activity_comments table
CREATE TABLE public.activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on activity_comments
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_comments
CREATE POLICY "Users can view comments on their own activities"
ON public.activity_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_comments.activity_id
    AND activities.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view comments on friends' completed activities"
ON public.activity_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_comments.activity_id
    AND activities.status = 'completed'
    AND public.are_friends(activities.user_id, auth.uid())
  )
);

CREATE POLICY "Users can comment on friends' completed activities"
ON public.activity_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_comments.activity_id
    AND activities.status = 'completed'
    AND (activities.user_id = auth.uid() OR public.are_friends(activities.user_id, auth.uid()))
  )
);

CREATE POLICY "Users can update their own comments"
ON public.activity_comments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.activity_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Add RLS policy to activities table to allow friends to view completed activities
CREATE POLICY "Users can view friends' completed activities"
ON public.activities
FOR SELECT
USING (
  status = 'completed'
  AND public.are_friends(user_id, auth.uid())
);

-- Create trigger for updating updated_at on activity_comments
CREATE TRIGGER update_activity_comments_updated_at
BEFORE UPDATE ON public.activity_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();