import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportTfLStationsProps {
  onComplete?: () => void;
}

const ImportTfLStations = ({ onComplete }: ImportTfLStationsProps) => {
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    try {
      setLoading(true);
      toast.info('Fetching stations from TfL...');

      const { data: fetched, error: fetchError } = await supabase.functions.invoke('fetch-tfl-stations');
      if (fetchError) {
        throw fetchError;
      }

      const stations = (fetched as any)?.stations;
      if (!Array.isArray(stations) || stations.length === 0) {
        throw new Error('No stations received from TfL');
      }

      toast.info(`Uploading ${stations.length} stations to database...`);
      const { data: uploadRes, error: uploadError } = await supabase.functions.invoke('upload-stations', {
        body: { stationsData: stations },
      });

      if (uploadError) {
        throw uploadError;
      }

      const count = (uploadRes as any)?.stationsCount ?? stations.length;
      toast.success(`Successfully imported ${count} stations`);
      onComplete?.();
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Import failed: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleImport} disabled={loading}>
      {loading ? 'Importing…' : 'Import TfL Stations'}
    </Button>
  );
};

export default ImportTfLStations;
