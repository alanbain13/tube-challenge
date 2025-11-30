-- Create friendships table for mutual friend relationships
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT different_users CHECK (user_id_1 != user_id_2),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- Create a unique index using an expression to prevent duplicate friendships
CREATE UNIQUE INDEX idx_unique_friendship 
ON public.friendships (LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2));

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can view friendships where they are involved
CREATE POLICY "Users can view their friendships"
ON public.friendships
FOR SELECT
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Users can create friend requests (they are user_id_1)
CREATE POLICY "Users can send friend requests"
ON public.friendships
FOR INSERT
WITH CHECK (auth.uid() = user_id_1 AND status = 'pending');

-- Users can update friendships where they are user_id_2 (accept/reject requests)
CREATE POLICY "Users can respond to friend requests"
ON public.friendships
FOR UPDATE
USING (auth.uid() = user_id_2)
WITH CHECK (auth.uid() = user_id_2);

-- Users can delete their own friendships
CREATE POLICY "Users can delete their friendships"
ON public.friendships
FOR DELETE
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Add trigger for updated_at
CREATE TRIGGER update_friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for faster queries
CREATE INDEX idx_friendships_user_id_1 ON public.friendships(user_id_1);
CREATE INDEX idx_friendships_user_id_2 ON public.friendships(user_id_2);
CREATE INDEX idx_friendships_status ON public.friendships(status);