import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncStationsFromGeoJSONProps {
  onComplete?: () => void;
}

const SyncStationsFromGeoJSON = ({ onComplete }: SyncStationsFromGeoJSONProps) => {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    try {
      setLoading(true);
      toast.info('Fetching GeoJSON and syncing stations...');

      // Fetch the GeoJSON data from public folder
      const response = await fetch('/data/stations.json');
      if (!response.ok) {
        throw new Error('Failed to fetch stations GeoJSON file');
      }
      const geojsonData = await response.json();

      // Pass the GeoJSON data to the edge function
      const { data: result, error } = await supabase.functions.invoke('sync-stations-from-geojson', {
        body: { geojsonData },
      });
      
      if (error) {
        throw error;
      }

      const count = (result as any)?.insertedCount ?? 0;
      const errors = (result as any)?.errors ?? 0;
      
      if (errors > 0) {
        toast.warning(`Synced ${count} stations with ${errors} errors`);
      } else {
        toast.success(`Successfully synced ${count} stations with correct zones and lines`);
      }
      
      onComplete?.();
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error(`Sync failed: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleSync} disabled={loading}>
      {loading ? 'Syncing…' : 'Sync Stations from GeoJSON'}
    </Button>
  );
};

export default SyncStationsFromGeoJSON;
