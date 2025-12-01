-- Create lines table for transport line metadata
CREATE TABLE IF NOT EXISTS public.lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  line_type TEXT NOT NULL,
  color TEXT,
  metro_system_id UUID REFERENCES public.metro_systems(id) ON DELETE CASCADE,
  station_count INTEGER,
  tfl_line_code TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;

-- Lines are viewable by everyone
CREATE POLICY "Lines are viewable by everyone"
ON public.lines FOR SELECT
USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lines_metro_system ON public.lines(metro_system_id);
CREATE INDEX IF NOT EXISTS idx_lines_line_type ON public.lines(line_type);

-- Insert London Underground tube lines
INSERT INTO public.lines (name, display_name, line_type, color, tfl_line_code, is_active, sort_order, metro_system_id)
SELECT 
  name,
  name || ' line' as display_name,
  'tube' as line_type,
  color,
  LOWER(name) as tfl_line_code,
  true as is_active,
  sort_order,
  (SELECT id FROM public.metro_systems WHERE code = 'london-underground' LIMIT 1) as metro_system_id
FROM (VALUES
  ('Bakerloo', '#B36305', 1),
  ('Central', '#E32017', 2),
  ('Circle', '#FFD300', 3),
  ('District', '#00782A', 4),
  ('Hammersmith & City', '#F3A9BB', 5),
  ('Jubilee', '#A0A5A9', 6),
  ('Metropolitan', '#9B0056', 7),
  ('Northern', '#000000', 8),
  ('Piccadilly', '#003688', 9),
  ('Victoria', '#0098D4', 10),
  ('Waterloo & City', '#95CDBA', 11)
) AS tube_lines(name, color, sort_order);

-- Insert other London transport lines
INSERT INTO public.lines (name, display_name, line_type, color, tfl_line_code, is_active, sort_order, metro_system_id)
SELECT 
  name,
  display_name,
  line_type,
  color,
  tfl_line_code,
  true as is_active,
  sort_order,
  (SELECT id FROM public.metro_systems WHERE code = 'london-underground' LIMIT 1) as metro_system_id
FROM (VALUES
  ('Elizabeth line', 'Elizabeth line', 'elizabeth', '#7156A5', 'elizabeth', 12),
  ('DLR', 'Docklands Light Railway', 'dlr', '#00A4A7', 'dlr', 13),
  ('London Overground', 'London Overground', 'overground', '#EE7C0E', 'london-overground', 14),
  ('Tram', 'London Trams', 'tram', '#84B817', 'tram', 15)
) AS other_lines(name, display_name, line_type, color, tfl_line_code, sort_order);

-- Create trigger for updated_at
CREATE TRIGGER update_lines_updated_at
BEFORE UPDATE ON public.lines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();