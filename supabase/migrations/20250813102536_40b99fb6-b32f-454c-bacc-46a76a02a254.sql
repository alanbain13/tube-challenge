-- Create routes table for predefined tube routes/challenges
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_station_tfl_id TEXT NOT NULL,
  end_station_tfl_id TEXT NOT NULL,
  estimated_duration_minutes INTEGER,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- Create policies for routes
CREATE POLICY "Users can view their own routes" 
ON public.routes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own routes" 
ON public.routes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routes" 
ON public.routes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routes" 
ON public.routes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create route_stations table for the sequence of stations in a route
CREATE TABLE public.route_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  station_tfl_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  is_bypass_allowed BOOLEAN NOT NULL DEFAULT false,
  estimated_arrival_offset_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.route_stations ENABLE ROW LEVEL SECURITY;

-- Create policies for route_stations (inherit from route)
CREATE POLICY "Users can view route stations for their routes" 
ON public.route_stations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.routes 
  WHERE routes.id = route_stations.route_id 
  AND routes.user_id = auth.uid()
));

CREATE POLICY "Users can create route stations for their routes" 
ON public.route_stations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.routes 
  WHERE routes.id = route_stations.route_id 
  AND routes.user_id = auth.uid()
));

CREATE POLICY "Users can update route stations for their routes" 
ON public.route_stations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.routes 
  WHERE routes.id = route_stations.route_id 
  AND routes.user_id = auth.uid()
));

CREATE POLICY "Users can delete route stations for their routes" 
ON public.route_stations 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.routes 
  WHERE routes.id = route_stations.route_id 
  AND routes.user_id = auth.uid()
));

-- Add unique constraint for route sequence
CREATE UNIQUE INDEX idx_route_stations_sequence ON public.route_stations(route_id, sequence_number);

-- Enhance station_visits table with new fields for detailed tracking
ALTER TABLE public.station_visits 
ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC,
ADD COLUMN IF NOT EXISTS checkin_type TEXT CHECK (checkin_type IN ('gps', 'image', 'manual')) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS verification_image_url TEXT,
ADD COLUMN IF NOT EXISTS ai_verification_result JSONB,
ADD COLUMN IF NOT EXISTS is_start_station BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_end_station BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_bypassed BOOLEAN DEFAULT false;

-- Add activities enhancements for detailed workflow
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS activity_type TEXT CHECK (activity_type IN ('open', 'route', 'challenge')) DEFAULT 'open',
ADD COLUMN IF NOT EXISTS timing_mode TEXT CHECK (timing_mode IN ('gate_to_gate', 'train_to_train')) DEFAULT 'gate_to_gate',
ADD COLUMN IF NOT EXISTS gate_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS platform_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS platform_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gate_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS start_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS start_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS end_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS end_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;

-- Create function to update updated_at timestamps
CREATE TRIGGER update_routes_updated_at
BEFORE UPDATE ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_station_visits_activity_sequence ON public.station_visits(activity_id, sequence_number);
CREATE INDEX idx_station_visits_coords ON public.station_visits(latitude, longitude);
CREATE INDEX idx_activities_route ON public.activities(route_id);
CREATE INDEX idx_activities_type_timing ON public.activities(activity_type, timing_mode);