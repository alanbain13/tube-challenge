-- Create a mapping table for station IDs to support both TfL IDs and UUIDs
CREATE TABLE public.station_id_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tfl_id TEXT NOT NULL UNIQUE,
  uuid_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the mapping table
ALTER TABLE public.station_id_mapping ENABLE ROW LEVEL SECURITY;

-- Create policy for reading station mappings (public access)
CREATE POLICY "Station mappings are viewable by everyone" 
ON public.station_id_mapping 
FOR SELECT 
USING (true);

-- Create a table for special interests at stations
CREATE TABLE public.station_special_interests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_tfl_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  interest_name TEXT NOT NULL,
  interest_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'visited', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on special interests
ALTER TABLE public.station_special_interests ENABLE ROW LEVEL SECURITY;

-- Create policies for special interests
CREATE POLICY "Users can view their own special interests" 
ON public.station_special_interests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own special interests" 
ON public.station_special_interests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own special interests" 
ON public.station_special_interests 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own special interests" 
ON public.station_special_interests 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on special interests
CREATE TRIGGER update_station_special_interests_updated_at
BEFORE UPDATE ON public.station_special_interests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update station_visits table to use tfl_id instead of station_id
-- First, add the new column
ALTER TABLE public.station_visits ADD COLUMN station_tfl_id TEXT;

-- Update the RLS policies to work with both old and new columns during transition
DROP POLICY IF EXISTS "Users can create their own visits" ON public.station_visits;
DROP POLICY IF EXISTS "Users can view their own visits" ON public.station_visits;
DROP POLICY IF EXISTS "Users can delete their own visits" ON public.station_visits;

CREATE POLICY "Users can create their own visits" 
ON public.station_visits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own visits" 
ON public.station_visits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visits" 
ON public.station_visits 
FOR DELETE 
USING (auth.uid() = user_id);