import { Station } from "@/hooks/useStations";

/**
 * Generate unique display names for stations
 * When multiple stations share the same name, append line information to disambiguate
 */
export function generateStationDisplayNames(stations: Station[]): Map<string, string> {
  const displayNames = new Map<string, string>();
  
  // Group stations by base name
  const stationsByName = new Map<string, Station[]>();
  stations.forEach(station => {
    const existing = stationsByName.get(station.name) || [];
    existing.push(station);
    stationsByName.set(station.name, existing);
  });
  
  // Generate display names
  stations.forEach(station => {
    const duplicates = stationsByName.get(station.name) || [];
    
    if (duplicates.length === 1) {
      // No duplicates, use base name
      displayNames.set(station.id, station.name);
    } else {
      // Multiple stations with same name - add line disambiguation
      const primaryLines = station.lines
        .slice(0, 3) // Limit to first 3 lines to keep display reasonable
        .map(line => line.name)
        .join(', ');
      
      const displayName = primaryLines 
        ? `${station.name} (${primaryLines})`
        : station.name;
      
      displayNames.set(station.id, displayName);
    }
  });
  
  return displayNames;
}

/**
 * Get display name for a single station
 */
export function getStationDisplayName(
  stationId: string, 
  stations: Station[], 
  displayNamesMap?: Map<string, string>
): string {
  const station = stations.find(s => s.id === stationId);
  if (!station) return stationId;
  
  // If we have a pre-computed map, use it
  if (displayNamesMap) {
    return displayNamesMap.get(stationId) || station.name;
  }
  
  // Otherwise compute on-the-fly
  const duplicates = stations.filter(s => s.name === station.name);
  
  if (duplicates.length === 1) {
    return station.name;
  }
  
  const primaryLines = station.lines
    .slice(0, 3)
    .map(line => line.name)
    .join(', ');
  
  return primaryLines ? `${station.name} (${primaryLines})` : station.name;
}
