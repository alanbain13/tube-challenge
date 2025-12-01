-- Enable pg_net extension (creates functions in net schema)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Update notify_on_like to use net.http_post with correct parameter order
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
  SELECT user_id INTO activity_owner_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  IF activity_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, activity_id)
    VALUES (activity_owner_id, 'like', NEW.user_id, NEW.activity_id);
    
    supabase_url := 'https://demmocgrnvkjbzxlhcdz.supabase.co';
    supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW1vY2dybnZramJ6eGxoY2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMjQ5NjgsImV4cCI6MjA2OTYwMDk2OH0.B67JALUZ06WVqlSvM5t0ikmuA2-htwPAzdSzuFs4n8g';
    
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      body := jsonb_build_object(
        'type', 'like',
        'recipient_user_id', activity_owner_id,
        'actor_user_id', NEW.user_id,
        'activity_id', NEW.activity_id
      ),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_on_comment to use net.http_post with correct parameter order
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
  SELECT user_id INTO activity_owner_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  IF activity_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, activity_id, comment_id)
    VALUES (activity_owner_id, 'comment', NEW.user_id, NEW.activity_id, NEW.id);
    
    supabase_url := 'https://demmocgrnvkjbzxlhcdz.supabase.co';
    supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW1vY2dybnZramJ6eGxoY2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMjQ5NjgsImV4cCI6MjA2OTYwMDk2OH0.B67JALUZ06WVqlSvM5t0ikmuA2-htwPAzdSzuFs4n8g';
    
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      body := jsonb_build_object(
        'type', 'comment',
        'recipient_user_id', activity_owner_id,
        'actor_user_id', NEW.user_id,
        'activity_id', NEW.activity_id,
        'comment_id', NEW.id
      ),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;