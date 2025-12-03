-- Add criteria column to badges table
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS criteria jsonb;

-- Update milestone badges with threshold values
UPDATE public.badges SET criteria = '{"threshold": 5}' WHERE name = 'First Steps' AND badge_type = 'milestone';
UPDATE public.badges SET criteria = '{"threshold": 10}' WHERE name = 'Explorer' AND badge_type = 'milestone';
UPDATE public.badges SET criteria = '{"threshold": 20}' WHERE name = 'Adventurer' AND badge_type = 'milestone';
UPDATE public.badges SET criteria = '{"threshold": 40}' WHERE name = 'Veteran' AND badge_type = 'milestone';
UPDATE public.badges SET criteria = '{"threshold": 100}' WHERE name = 'Century Club' AND badge_type = 'milestone';
UPDATE public.badges SET criteria = '{"threshold": 150}' WHERE name = 'Master Explorer' AND badge_type = 'milestone';
UPDATE public.badges SET criteria = '{"threshold": 272}' WHERE name = 'Network Legend' AND badge_type = 'milestone';

-- Update zone badges with zone identifiers
UPDATE public.badges SET criteria = '{"zone": "1"}' WHERE name = 'Zone 1 Master' AND badge_type = 'zone';
UPDATE public.badges SET criteria = '{"zone": "2"}' WHERE name = 'Zone 2 Master' AND badge_type = 'zone';
UPDATE public.badges SET criteria = '{"zone": "3"}' WHERE name = 'Zone 3 Master' AND badge_type = 'zone';
UPDATE public.badges SET criteria = '{"zone": "4"}' WHERE name = 'Zone 4 Master' AND badge_type = 'zone';
UPDATE public.badges SET criteria = '{"zone": "5"}' WHERE name = 'Zone 5 Master' AND badge_type = 'zone';
UPDATE public.badges SET criteria = '{"zone": "6"}' WHERE name = 'Zone 6 Master' AND badge_type = 'zone';

-- Update line badges with line identifiers (matching tfl_line_code in lines table)
UPDATE public.badges SET criteria = '{"line": "bakerloo"}' WHERE name = 'Bakerloo Baron' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "central"}' WHERE name = 'Central Champion' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "circle"}' WHERE name = 'Circle Specialist' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "district"}' WHERE name = 'District Duke' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "hammersmith-city"}' WHERE name = 'H&C Hero' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "jubilee"}' WHERE name = 'Jubilee Juggernaut' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "metropolitan"}' WHERE name = 'Metropolitan Master' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "northern"}' WHERE name = 'Northern Navigator' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "piccadilly"}' WHERE name = 'Piccadilly Pro' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "victoria"}' WHERE name = 'Victoria Victor' AND badge_type = 'line';
UPDATE public.badges SET criteria = '{"line": "waterloo-city"}' WHERE name = 'Waterloo Warrior' AND badge_type = 'line';