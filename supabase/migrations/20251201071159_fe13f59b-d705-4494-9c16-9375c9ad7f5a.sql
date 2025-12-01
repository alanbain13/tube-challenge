-- Link all lines to the London Underground metro system
UPDATE lines 
SET metro_system_id = '4a262dac-f2ae-4432-bd96-3d412f3dfc86'
WHERE metro_system_id IS NULL;