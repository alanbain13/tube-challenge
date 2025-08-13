import { useState, useEffect } from 'react';

export interface Station {
  id: string;
  name: string;
  zone: string;
  lines: Array<{ name: string; nightopened?: number }>;
  coordinates: [number, number];
}

export const useStations = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const response = await fetch('/data/stations.json');
        if (!response.ok) {
          throw new Error('Failed to fetch stations');
        }
        
        const geoJsonData = await response.json();
        const stationData = geoJsonData.features.map((feature: any) => ({
          id: feature.properties.id,
          name: feature.properties.name,
          zone: feature.properties.zone,
          lines: feature.properties.lines || [],
          coordinates: feature.geometry.coordinates,
        }));
        
        setStations(stationData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadStations();
  }, []);

  return { stations, loading, error };
};