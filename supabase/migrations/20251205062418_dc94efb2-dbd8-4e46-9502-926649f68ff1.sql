-- Update all stations to have London Underground metro_system_id
UPDATE stations 
SET metro_system_id = '4a262dac-f2ae-4432-bd96-3d412f3dfc86'
WHERE metro_system_id IS NULL;