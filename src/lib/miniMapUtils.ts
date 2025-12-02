import { Feature, LineString, FeatureCollection } from 'geojson';

interface BuildMiniMapOptions {
  type: 'route' | 'activity';
  stationSequence: string[];
  visitedStations?: Array<{ station_tfl_id: string; seq_actual: number }>;
  remainingStations?: Array<{ station_tfl_id: string; seq_planned: number }>;
  isSequenced?: boolean; // For challenges: if false, don't draw planned paths
}

interface StationCoordinates {
  [key: string]: [number, number];
}

// Station coordinates map (from stations.json)
let stationCoordinatesCache: StationCoordinates | null = null;

const loadStationCoordinates = async (): Promise<StationCoordinates> => {
  if (stationCoordinatesCache) return stationCoordinatesCache;

  try {
    const response = await fetch('/data/stations.json');
    const geoJsonData = await response.json();
    
    const coordinates: StationCoordinates = {};
    geoJsonData.features
      .filter((feature: any) => feature.geometry.type === 'Point')
      .forEach((feature: any) => {
        coordinates[feature.properties.id] = feature.geometry.coordinates;
      });
    
    stationCoordinatesCache = coordinates;
    return coordinates;
  } catch (error) {
    console.error('Error loading station coordinates:', error);
    return {};
  }
};

export const buildMiniMapGeoJson = async (
  options: BuildMiniMapOptions
): Promise<FeatureCollection> => {
  const { type, stationSequence, visitedStations = [], remainingStations = [], isSequenced = true } = options;
  
  const coordinates = await loadStationCoordinates();
  const features: Feature<LineString>[] = [];

  if (type === 'route') {
    // Build single dotted line for entire route
    const routeCoords = stationSequence
      .map(stationId => coordinates[stationId])
      .filter(Boolean);

    if (routeCoords.length > 1) {
      features.push({
        type: 'Feature',
        properties: { type: 'route' },
        geometry: {
          type: 'LineString',
          coordinates: routeCoords
        }
      });
    }
  } else if (type === 'activity') {
    // Build visited path (solid)
    if (visitedStations.length > 1) {
      const sortedVisited = [...visitedStations].sort((a, b) => a.seq_actual - b.seq_actual);
      const visitedCoords = sortedVisited
        .map(v => coordinates[v.station_tfl_id])
        .filter(Boolean);

      if (visitedCoords.length > 1) {
        features.push({
          type: 'Feature',
          properties: { type: 'visited' },
          geometry: {
            type: 'LineString',
            coordinates: visitedCoords
          }
        });
      }
    }

    // Build remaining path (dotted) - ONLY for sequenced activities
    // For unsequenced challenges, skip this to avoid showing misleading paths
    if (isSequenced && remainingStations.length > 0) {
      const sortedRemaining = [...remainingStations].sort((a, b) => a.seq_planned - b.seq_planned);
      
      // Connect last visited to first remaining
      let plannedCoords: [number, number][] = [];
      
      if (visitedStations.length > 0) {
        const lastVisited = [...visitedStations].sort((a, b) => b.seq_actual - a.seq_actual)[0];
        const lastVisitedCoord = coordinates[lastVisited.station_tfl_id];
        if (lastVisitedCoord) {
          plannedCoords.push(lastVisitedCoord);
        }
      }
      
      const remainingCoords = sortedRemaining
        .map(r => coordinates[r.station_tfl_id])
        .filter(Boolean);
      
      plannedCoords = [...plannedCoords, ...remainingCoords];

      if (plannedCoords.length > 1) {
        features.push({
          type: 'Feature',
          properties: { type: 'planned' },
          geometry: {
            type: 'LineString',
            coordinates: plannedCoords
          }
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
};
