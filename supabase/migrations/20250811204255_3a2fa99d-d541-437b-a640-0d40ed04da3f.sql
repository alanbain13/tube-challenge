-- Phase 3/1: Extend station_visits for status & verification metadata
-- Safe-add columns
ALTER TABLE public.station_visits
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Backfill existing rows to visited, then enforce NOT NULL with default 'pending'
UPDATE public.station_visits SET status = 'visited' WHERE status IS NULL;
ALTER TABLE public.station_visits
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending';

-- Add immutable checks via constraints for status and verification_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'station_visits_status_check'
  ) THEN
    ALTER TABLE public.station_visits
      ADD CONSTRAINT station_visits_status_check
      CHECK (status IN ('pending','visited'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'station_visits_verification_method_check'
  ) THEN
    ALTER TABLE public.station_visits
      ADD CONSTRAINT station_visits_verification_method_check
      CHECK (
        verification_method IS NULL OR
        verification_method IN ('gps','photo','manual')
      );
  END IF;
END $$;

-- Ensure uniqueness per user/station TfL id (ignore NULLs via partial index)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_visits_user_tfl
  ON public.station_visits (user_id, station_tfl_id)
  WHERE station_tfl_id IS NOT NULL;

-- Deduplicate any existing duplicates before the unique index is enforced (in case it already existed)
WITH ranked AS (
  SELECT id, user_id, station_tfl_id, visited_at,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, station_tfl_id
           ORDER BY visited_at ASC, id ASC
         ) AS rn
  FROM public.station_visits
  WHERE station_tfl_id IS NOT NULL
)
DELETE FROM public.station_visits sv
USING ranked r
WHERE sv.id = r.id AND r.rn > 1;

-- Allow users to update their own visits (needed for status/verification updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'station_visits'
      AND policyname = 'Users can update their own visits'
  ) THEN
    CREATE POLICY "Users can update their own visits"
      ON public.station_visits
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Phase 2: Activities table
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  distance_km numeric NULL,
  station_tfl_ids text[] NOT NULL,
  line_ids text[] NULL,
  title text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Indexes for activities
CREATE INDEX IF NOT EXISTS idx_activities_user ON public.activities (user_id);
CREATE INDEX IF NOT EXISTS idx_activities_started_at ON public.activities (started_at DESC);

-- RLS for activities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activities' AND policyname='Users can view their own activities'
  ) THEN
    CREATE POLICY "Users can view their own activities"
      ON public.activities
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activities' AND policyname='Users can create their own activities'
  ) THEN
    CREATE POLICY "Users can create their own activities"
      ON public.activities
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activities' AND policyname='Users can update their own activities'
  ) THEN
    CREATE POLICY "Users can update their own activities"
      ON public.activities
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activities' AND policyname='Users can delete their own activities'
  ) THEN
    CREATE POLICY "Users can delete their own activities"
      ON public.activities
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Phase 4: Achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  progress numeric NULL,
  meta jsonb NULL,
  CONSTRAINT achievements_user_key_unique UNIQUE (user_id, key)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Indexes for achievements
CREATE INDEX IF NOT EXISTS idx_achievements_user ON public.achievements (user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_earned_at ON public.achievements (earned_at DESC);

-- RLS for achievements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='achievements' AND policyname='Users can view their own achievements'
  ) THEN
    CREATE POLICY "Users can view their own achievements"
      ON public.achievements
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='achievements' AND policyname='Users can create their own achievements'
  ) THEN
    CREATE POLICY "Users can create their own achievements"
      ON public.achievements
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='achievements' AND policyname='Users can update their own achievements'
  ) THEN
    CREATE POLICY "Users can update their own achievements"
      ON public.achievements
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='achievements' AND policyname='Users can delete their own achievements'
  ) THEN
    CREATE POLICY "Users can delete their own achievements"
      ON public.achievements
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Phase 2/3: Private storage buckets for verification and activity photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification', 'verification', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-photos', 'activity-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (users can manage files in their own folder: <user_id>/...)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can read their verification files'
  ) THEN
    CREATE POLICY "Users can read their verification files" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'verification' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload verification files'
  ) THEN
    CREATE POLICY "Users can upload verification files" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'verification' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update their verification files'
  ) THEN
    CREATE POLICY "Users can update their verification files" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'verification' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete their verification files'
  ) THEN
    CREATE POLICY "Users can delete their verification files" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'verification' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- Activity photos bucket policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can read their activity photos'
  ) THEN
    CREATE POLICY "Users can read their activity photos" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload activity photos'
  ) THEN
    CREATE POLICY "Users can upload activity photos" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update their activity photos'
  ) THEN
    CREATE POLICY "Users can update their activity photos" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete their activity photos'
  ) THEN
    CREATE POLICY "Users can delete their activity photos" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;