-- Insert timed achievement badges
INSERT INTO public.badges (name, description, badge_type, image_url, criteria) VALUES
('Lunchtime Legend', 'Visit 10 stations in 30 minutes', 'timed', '🥪', '{"threshold": 10, "time_limit_minutes": 30}'),
('Hour Hero', 'Visit 20 stations in 60 minutes', 'timed', '⏱️', '{"threshold": 20, "time_limit_minutes": 60}'),
('Speed Demon', 'Visit 30 stations in 60 minutes', 'timed', '👹', '{"threshold": 30, "time_limit_minutes": 60}'),
('Rapid Runner', 'Visit 40 stations in 90 minutes', 'timed', '🏃', '{"threshold": 40, "time_limit_minutes": 90}'),
('Ultra Explorer', 'Visit 50 stations in 120 minutes', 'timed', '🚀', '{"threshold": 50, "time_limit_minutes": 120}'),
('Zone 1 Speedrun', 'Visit all 67 Zone 1 stations in 180 minutes', 'timed', '⚡', '{"threshold": 67, "time_limit_minutes": 180, "zone": "1"}');