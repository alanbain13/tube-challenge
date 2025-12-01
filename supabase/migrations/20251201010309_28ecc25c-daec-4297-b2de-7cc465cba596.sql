-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  actor_id uuid NOT NULL,
  activity_id uuid,
  comment_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger function for likes
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_owner_id uuid;
BEGIN
  -- Get the activity owner
  SELECT user_id INTO activity_owner_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  -- Don't notify if user likes their own activity
  IF activity_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, activity_id)
    VALUES (activity_owner_id, 'like', NEW.user_id, NEW.activity_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger function for comments
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_owner_id uuid;
BEGIN
  -- Get the activity owner
  SELECT user_id INTO activity_owner_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  -- Don't notify if user comments on their own activity
  IF activity_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, activity_id, comment_id)
    VALUES (activity_owner_id, 'comment', NEW.user_id, NEW.activity_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_activity_like
AFTER INSERT ON activity_likes
FOR EACH ROW
EXECUTE FUNCTION notify_on_like();

CREATE TRIGGER on_activity_comment
AFTER INSERT ON activity_comments
FOR EACH ROW
EXECUTE FUNCTION notify_on_comment();

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;