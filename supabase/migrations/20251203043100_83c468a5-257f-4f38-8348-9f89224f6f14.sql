-- Seed milestone badges
INSERT INTO public.badges (name, description, image_url, badge_type) VALUES
('First Steps', 'Visit 5 unique stations', '🚶', 'milestone'),
('Explorer', 'Visit 10 unique stations', '🔍', 'milestone'),
('Adventurer', 'Visit 20 unique stations', '🧭', 'milestone'),
('Veteran', 'Visit 40 unique stations', '🎖️', 'milestone'),
('Century Club', 'Visit 100 unique stations', '💯', 'milestone'),
('Master Explorer', 'Visit 150 unique stations', '🗺️', 'milestone'),
('Network Legend', 'Visit all 272 stations', '🏆', 'milestone');

-- Seed zone completion badges
INSERT INTO public.badges (name, description, image_url, badge_type) VALUES
('Zone 1 Master', 'Visit all Zone 1 stations', '🥇', 'zone'),
('Zone 2 Master', 'Visit all Zone 2 stations', '🥈', 'zone'),
('Zone 3 Master', 'Visit all Zone 3 stations', '🥉', 'zone'),
('Zone 4 Master', 'Visit all Zone 4 stations', '🏅', 'zone'),
('Zone 5 Master', 'Visit all Zone 5 stations', '🎖️', 'zone'),
('Zone 6 Master', 'Visit all Zone 6 stations', '⭐', 'zone');

-- Seed line completion badges
INSERT INTO public.badges (name, description, image_url, badge_type) VALUES
('Bakerloo Baron', 'Visit all Bakerloo line stations', '🟤', 'line'),
('Central Champion', 'Visit all Central line stations', '🔴', 'line'),
('Circle Specialist', 'Visit all Circle line stations', '🟡', 'line'),
('District Duke', 'Visit all District line stations', '🟢', 'line'),
('H&C Hero', 'Visit all Hammersmith & City line stations', '💗', 'line'),
('Jubilee Juggernaut', 'Visit all Jubilee line stations', '⚪', 'line'),
('Metropolitan Master', 'Visit all Metropolitan line stations', '🟣', 'line'),
('Northern Navigator', 'Visit all Northern line stations', '⚫', 'line'),
('Piccadilly Pro', 'Visit all Piccadilly line stations', '🔵', 'line'),
('Victoria Victor', 'Visit all Victoria line stations', '🩵', 'line'),
('Waterloo Warrior', 'Visit all Waterloo & City line stations', '🌊', 'line');