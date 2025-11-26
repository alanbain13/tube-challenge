import { useState, useEffect } from 'react';

export interface Station {
  id: string;
  name: string;
  displayName: string; // Unique display name with line disambiguation
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
        
        // Filter to station-level IDs only (exclude platform duplicates)
        // Station-level IDs: 940G*, 910G*, HUBPAD
        // Platform-level IDs (exclude): 9400*, 4900*
        const uniqueStations = new Map();
        const stationsByName = new Map<string, any[]>();
        
        geoJsonData.features
          .filter((feature: any) => {
            if (feature.geometry.type !== 'Point') return false;
            const id = feature.properties.id;
            // Only include station-level IDs
            return id.startsWith('940G') || id.startsWith('910G') || id === 'HUBPAD';
          })
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
              
              // Group by name to detect duplicates
              const nameGroup = stationsByName.get(station.name) || [];
              nameGroup.push(station);
              stationsByName.set(station.name, nameGroup);
            }
          });
        
        // Generate display names with line disambiguation for duplicates
        const stationsArray = Array.from(uniqueStations.values());
        const stationsWithDisplayNames = stationsArray.map(station => {
          const duplicates = stationsByName.get(station.name) || [];
          
          if (duplicates.length === 1) {
            // No duplicates, use base name
            return { ...station, displayName: station.name };
          } else {
            // Multiple stations with same name - add line disambiguation
            const primaryLines = station.lines
              .slice(0, 3) // Limit to first 3 lines
              .map((line: any) => line.name)
              .join(', ');
            
            const displayName = primaryLines 
              ? `${station.name} (${primaryLines})`
              : station.name;
            
            return { ...station, displayName };
          }
        });
        
        setStations(stationsWithDisplayNames);
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