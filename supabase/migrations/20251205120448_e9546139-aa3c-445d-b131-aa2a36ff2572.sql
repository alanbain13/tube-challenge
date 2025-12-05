-- Make activity-photos bucket public so URLs work correctly
UPDATE storage.buckets 
SET public = true 
WHERE id = 'activity-photos';