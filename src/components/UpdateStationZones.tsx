import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateStationZonesProps {
  onComplete?: () => void;
}

const UpdateStationZones = ({ onComplete }: UpdateStationZonesProps) => {
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      toast.info('Fetching GeoJSON and updating station zones...');

      // Fetch the GeoJSON data first
      const response = await fetch('/data/stations.json');
      if (!response.ok) {
        throw new Error('Failed to fetch stations GeoJSON');
      }
      const geojsonData = await response.json();

      // Call the edge function with the GeoJSON data
      const { data, error } = await supabase.functions.invoke('update-station-zones', {
        body: { geojsonData },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast.success(`Successfully updated ${data.updatedCount} station zones`);
        onComplete?.();
      } else {
        throw new Error(data.error || 'Update failed');
      }
    } catch (err: any) {
      console.error('Update error:', err);
      toast.error(`Update failed: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleUpdate} disabled={loading}>
      {loading ? 'Updating Zones…' : 'Update Station Zones'}
    </Button>
  );
};

export default UpdateStationZones;