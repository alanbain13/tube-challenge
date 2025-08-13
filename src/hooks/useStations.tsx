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
        
        // Filter out duplicate station IDs to avoid React key warnings
        const uniqueStations = new Map();
        const stationData = geoJsonData.features
          .filter((feature: any) => feature.geometry.type === 'Point')
          .forEach((feature: any) => {
            const station = {
              id: feature.properties.id,
              name: feature.properties.name,
              zone: feature.properties.zone,
              lines: feature.properties.lines || [],
              coordinates: feature.geometry.coordinates,
            };
            // Keep the first occurrence of each station ID
            if (!uniqueStations.has(station.id)) {
              uniqueStations.set(station.id, station);
            }
          });
        
        setStations(Array.from(uniqueStations.values()));
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