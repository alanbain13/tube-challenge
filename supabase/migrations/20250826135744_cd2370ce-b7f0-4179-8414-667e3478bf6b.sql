-- Clean up duplicate Nine Elms entries and ensure correct mapping

-- Remove the incorrect Nine Elms entry
DELETE FROM stations 
WHERE tfl_id = '940GZZNEUGST' AND name = 'Nine Elms Underground Station';

-- Update the correct entry to have proper name format
UPDATE stations 
SET name = 'Nine Elms'
WHERE tfl_id = '940GZZLU990';