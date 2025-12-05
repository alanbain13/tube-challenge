-- Create activity_photos table for additional activity photos
CREATE TABLE public.activity_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  thumb_url TEXT,
  caption TEXT,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own activity photos"
  ON public.activity_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view photos on friends' completed activities"
  ON public.activity_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = activity_photos.activity_id
        AND activities.status = 'completed'
        AND are_friends(activities.user_id, auth.uid())
    )
  );

CREATE POLICY "Users can create photos for their own activities"
  ON public.activity_photos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = activity_photos.activity_id
        AND activities.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own activity photos"
  ON public.activity_photos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity photos"
  ON public.activity_photos FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_activity_photos_activity_id ON public.activity_photos(activity_id);
CREATE INDEX idx_activity_photos_user_id ON public.activity_photos(user_id);