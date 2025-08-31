import { UnifiedActivityState } from '@/hooks/useActivityState';

export interface ActivityMapData {
  visitedPins: GeoJSON.FeatureCollection;
  plannedPins: GeoJSON.FeatureCollection;
  visitedPath: GeoJSON.FeatureCollection;
  plannedPath: GeoJSON.FeatureCollection;
  roundels: GeoJSON.FeatureCollection;
}

export interface StationData {
  id: string;
  name: string;
  coordinates: [number, number];
}

/**
 * Builds GeoJSON data for activity map visualization
 */
export const buildActivityGeoJSON = (
  activityState: UnifiedActivityState,
  allStations: StationData[]
): ActivityMapData => {
  const stationMap = new Map(allStations.map(s => [s.id, s]));
  
  // Get activity station IDs for filtering roundels
  const activityStationIds = new Set([
    ...activityState.visited.map(v => v.station_tfl_id),
    ...(activityState.remaining?.map(r => r.station_tfl_id) || [])
  ]);

  // Build visited pins
  const visitedFeatures = activityState.visited.map(visit => {
    const station = stationMap.get(visit.station_tfl_id);
    if (!station) return null;
    
    return {
      type: 'Feature' as const,
      properties: {
        station_tfl_id: visit.station_tfl_id,
        station_name: station.name,
        labelNum: visit.seq_actual,
        state: visit.status === 'pending' ? 'pending' : 'visited',
        pinType: 'activity'
      },
      geometry: {
        type: 'Point' as const,
        coordinates: station.coordinates
      }
    };
  }).filter(Boolean);

  // Build planned pins (remaining)
  const plannedFeatures = (activityState.remaining || []).map(item => {
    const station = stationMap.get(item.station_tfl_id);
    if (!station) return null;
    
    return {
      type: 'Feature' as const,
      properties: {
        station_tfl_id: item.station_tfl_id,
        station_name: station.name,
        labelNum: item.seq_planned,
        state: 'planned',
        pinType: 'activity'
      },
      geometry: {
        type: 'Point' as const,
        coordinates: station.coordinates
      }
    };
  }).filter(Boolean);

  // Build visited path (solid line)
  const visitedPathCoords = activityState.visited
    .sort((a, b) => a.seq_actual - b.seq_actual)
    .map(visit => {
      const station = stationMap.get(visit.station_tfl_id);
      return station ? station.coordinates : null;
    })
    .filter(Boolean);

  const visitedPath: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: visitedPathCoords.length > 1 ? [{
      type: 'Feature',
      properties: { pathType: 'visited' },
      geometry: {
        type: 'LineString',
        coordinates: visitedPathCoords
      }
    }] : []
  };

  // Build planned preview path (dotted line from last visited to remaining planned)
  let plannedPathCoords: [number, number][] = [];
  if (activityState.mode === 'planned' && activityState.remaining && activityState.remaining.length > 0) {
    // Start from last visited station
    if (activityState.visited.length > 0) {
      const lastVisited = activityState.visited
        .sort((a, b) => a.seq_actual - b.seq_actual)
        .slice(-1)[0];
      const lastStation = stationMap.get(lastVisited.station_tfl_id);
      if (lastStation) {
        plannedPathCoords.push(lastStation.coordinates);
      }
    }
    
    // Add remaining planned stations in sequence
    const remainingCoords = activityState.remaining
      .sort((a, b) => a.seq_planned - b.seq_planned)
      .map(item => {
        const station = stationMap.get(item.station_tfl_id);
        return station ? station.coordinates : null;
      })
      .filter(Boolean);
    
    plannedPathCoords.push(...remainingCoords);
  }

  const plannedPath: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: plannedPathCoords.length > 1 ? [{
      type: 'Feature',
      properties: { pathType: 'planned' },
      geometry: {
        type: 'LineString',
        coordinates: plannedPathCoords
      }
    }] : []
  };

  // Build roundels for non-activity stations
  const roundelFeatures = allStations
    .filter(station => !activityStationIds.has(station.id))
    .map(station => ({
      type: 'Feature' as const,
      properties: {
        station_tfl_id: station.id,
        station_name: station.name,
        pinType: 'roundel'
      },
      geometry: {
        type: 'Point' as const,
        coordinates: station.coordinates
      }
    }));

  return {
    visitedPins: {
      type: 'FeatureCollection',
      features: visitedFeatures
    },
    plannedPins: {
      type: 'FeatureCollection',
      features: plannedFeatures
    },
    visitedPath,
    plannedPath,
    roundels: {
      type: 'FeatureCollection',
      features: roundelFeatures
    }
  };
};

/**
 * Creates SVG pin images for Mapbox
 */
export const createPinSVG = (color: string, number: string, size: number = 34): string => {
  const displayNumber = parseInt(number) >= 100 ? '99+' : number;
  
  return `
    <svg width="${size}" height="${size * 1.2}" viewBox="0 0 34 41" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <dropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      <!-- Pin body -->
      <path d="M17 0C7.6 0 0 7.6 0 17c0 9.4 17 24 17 24s17-14.6 17-24C34 7.6 26.4 0 17 0z" 
            fill="${color}" stroke="white" stroke-width="2" filter="url(#shadow)"/>
      <!-- White circle for number -->
      <circle cx="17" cy="17" r="10" fill="white" stroke="${color}" stroke-width="1"/>
      <!-- Number text -->
      <text x="17" y="22" text-anchor="middle" font-family="Arial, sans-serif" 
            font-size="${displayNumber.length > 2 ? '8' : '12'}" font-weight="bold" fill="${color}">
        ${displayNumber}
      </text>
    </svg>
  `.trim();
};

/**
 * Creates TfL roundel SVG
 */
export const createRoundelSVG = (size: number = 16): string => {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" fill="none" stroke="#9ca3af" stroke-width="2"/>
      <rect x="2" y="7" width="12" height="2" fill="#9ca3af"/>
    </svg>
  `.trim();
};