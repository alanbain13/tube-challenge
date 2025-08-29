-- Create activity_plan_item table for planned activities
CREATE TABLE public.activity_plan_item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL,
  station_tfl_id TEXT NOT NULL,
  seq_planned INTEGER NOT NULL,
  line_hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.activity_plan_item ENABLE ROW LEVEL SECURITY;

-- Create policies for activity_plan_item
CREATE POLICY "Users can view their own activity plan items" 
ON public.activity_plan_item 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM activities 
  WHERE activities.id = activity_plan_item.activity_id 
  AND activities.user_id = auth.uid()
));

CREATE POLICY "Users can create activity plan items for their activities" 
ON public.activity_plan_item 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM activities 
  WHERE activities.id = activity_plan_item.activity_id 
  AND activities.user_id = auth.uid()
));

CREATE POLICY "Users can update their own activity plan items" 
ON public.activity_plan_item 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM activities 
  WHERE activities.id = activity_plan_item.activity_id 
  AND activities.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own activity plan items" 
ON public.activity_plan_item 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM activities 
  WHERE activities.id = activity_plan_item.activity_id 
  AND activities.user_id = auth.uid()
));

-- Add unique constraint to prevent duplicates within activity
ALTER TABLE public.activity_plan_item 
ADD CONSTRAINT unique_activity_station UNIQUE (activity_id, station_tfl_id);

-- Add foreign key reference to activities table
ALTER TABLE public.activity_plan_item 
ADD CONSTRAINT fk_activity_plan_item_activity 
FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_activity_plan_item_activity_id ON public.activity_plan_item(activity_id);
CREATE INDEX idx_activity_plan_item_seq_planned ON public.activity_plan_item(activity_id, seq_planned);