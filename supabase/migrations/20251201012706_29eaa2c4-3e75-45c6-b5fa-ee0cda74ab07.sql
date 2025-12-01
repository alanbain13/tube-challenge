-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_on_like BOOLEAN NOT NULL DEFAULT true,
  email_on_comment BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create notification preferences on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_notification_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger to create notification preferences when user signs up
CREATE TRIGGER on_auth_user_created_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_notification_prefs();

-- Modify notify_on_like to call edge function
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_owner_id uuid;
  supabase_url text;
  supabase_anon_key text;
BEGIN
  -- Get the activity owner
  SELECT user_id INTO activity_owner_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  -- Don't notify if user likes their own activity
  IF activity_owner_id != NEW.user_id THEN
    -- Create in-app notification
    INSERT INTO notifications (user_id, type, actor_id, activity_id)
    VALUES (activity_owner_id, 'like', NEW.user_id, NEW.activity_id);
    
    -- Call edge function for email notification
    supabase_url := 'https://demmocgrnvkjbzxlhcdz.supabase.co';
    supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW1vY2dybnZramJ6eGxoY2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMjQ5NjgsImV4cCI6MjA2OTYwMDk2OH0.B67JALUZ06WVqlSvM5t0ikmuA2-htwPAzdSzuFs4n8g';
    
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
      ),
      body := jsonb_build_object(
        'type', 'like',
        'recipient_user_id', activity_owner_id,
        'actor_user_id', NEW.user_id,
        'activity_id', NEW.activity_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Modify notify_on_comment to call edge function
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_owner_id uuid;
  supabase_url text;
  supabase_anon_key text;
BEGIN
  -- Get the activity owner
  SELECT user_id INTO activity_owner_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  -- Don't notify if user comments on their own activity
  IF activity_owner_id != NEW.user_id THEN
    -- Create in-app notification
    INSERT INTO notifications (user_id, type, actor_id, activity_id, comment_id)
    VALUES (activity_owner_id, 'comment', NEW.user_id, NEW.activity_id, NEW.id);
    
    -- Call edge function for email notification
    supabase_url := 'https://demmocgrnvkjbzxlhcdz.supabase.co';
    supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW1vY2dybnZramJ6eGxoY2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMjQ5NjgsImV4cCI6MjA2OTYwMDk2OH0.B67JALUZ06WVqlSvM5t0ikmuA2-htwPAzdSzuFs4n8g';
    
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
      ),
      body := jsonb_build_object(
        'type', 'comment',
        'recipient_user_id', activity_owner_id,
        'actor_user_id', NEW.user_id,
        'activity_id', NEW.activity_id,
        'comment_id', NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;