-- Create metro_systems table
CREATE TABLE public.metro_systems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  station_count INTEGER,
  line_count INTEGER,
  is_active BOOLEAN DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for metro_systems
ALTER TABLE public.metro_systems ENABLE ROW LEVEL SECURITY;

-- Metro systems are viewable by everyone
CREATE POLICY "Metro systems are viewable by everyone"
ON public.metro_systems
FOR SELECT
USING (true);

-- Add metro_system_id to stations table
ALTER TABLE public.stations
ADD COLUMN metro_system_id UUID REFERENCES public.metro_systems(id);

-- Insert initial metro systems
INSERT INTO public.metro_systems (name, city, country, code, station_count, line_count, is_active, image_url)
VALUES 
  ('London Underground', 'London', 'United Kingdom', 'london', 272, 11, true, 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=400&fit=crop'),
  ('Paris Métro', 'Paris', 'France', 'paris', 302, 16, false, 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=400&fit=crop'),
  ('Vienna U-Bahn', 'Vienna', 'Austria', 'vienna', 109, 5, false, 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&h=400&fit=crop');

-- Update existing stations to belong to London Underground
UPDATE public.stations
SET metro_system_id = (SELECT id FROM public.metro_systems WHERE code = 'london')
WHERE metro_system_id IS NULL;

-- Create trigger for automatic timestamp updates on metro_systems
CREATE TRIGGER update_metro_systems_updated_at
BEFORE UPDATE ON public.metro_systems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();