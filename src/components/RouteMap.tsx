import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useStations, Station } from '@/hooks/useStations';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface StationVisit {
  station_tfl_id: string;
  status: 'pending' | 'verified' | 'rejected';
  sequence_number: number;
}

interface RouteMapProps {
  selectedStations: string[];
  onStationSelect: (stationId: string) => void;
  onStationRemove: (stationId: string) => void;
  onSequenceChange: (fromIndex: number, toIndex: number) => void;
  onStationSetRole?: (stationId: string, role: 'start' | 'finish') => void;
  readOnly?: boolean;
  visits?: StationVisit[];
  activityStations?: string[]; // Complete list of stations in activity sequence
  activityMode?: 'planned' | 'unplanned'; // undefined = route creation/view mode
}

const RouteMap: React.FC<RouteMapProps> = ({
  selectedStations,
  onStationSelect,
  onStationRemove,
  onSequenceChange,
  onStationSetRole,
  readOnly = false,
  visits = [],
  activityStations = [],
  activityMode // undefined for route creation/view mode
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const selectedStationsRef = useRef<string[]>(selectedStations);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [tokenValid, setTokenValid] = useState<boolean>(false);
  const [lineFeatures, setLineFeatures] = useState<any[]>([]);
  const { stations, loading } = useStations();

  // Check for existing token
  useEffect(() => {
    console.log('🔧 RouteMap: Checking for existing Mapbox token...');
    const savedToken = localStorage.getItem('mapbox_token');
    console.log('🔧 RouteMap: Saved token exists:', !!savedToken);
    if (savedToken) {
      console.log('🔧 RouteMap: Setting token and marking as valid');
      setMapboxToken(savedToken);
      setTokenValid(true);
    } else {
      console.log('❌ RouteMap: No Mapbox token found in localStorage');
    }
  }, []);

  const validateToken = () => {
    console.log('🔧 RouteMap: Validating token:', mapboxToken.substring(0, 10) + '...');
    if (mapboxToken.startsWith('pk.')) {
      console.log('✅ RouteMap: Token is valid, saving to localStorage');
      localStorage.setItem('mapbox_token', mapboxToken);
      setTokenValid(true);
    } else {
      console.log('❌ RouteMap: Invalid token format');
      alert('Please enter a valid Mapbox public token (starts with pk.)');
    }
  };

  useEffect(() => {
    loadLinesFromGeoJSON();
  }, []);

  useEffect(() => {
    console.log('🗺️ RouteMap useEffect - Map initialization check:', {
      hasContainer: !!mapContainer.current,
      tokenValid,
      loading,
      stationsCount: stations.length,
      mapboxToken: mapboxToken ? 'present' : 'missing'
    });
    
    if (!mapContainer.current || !tokenValid || loading || stations.length === 0) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-0.1276, 51.5074], // London center
      zoom: 10
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      console.log('🗺️ RouteMap - Map loaded, adding data...');
      addTubeLinesToMap();
      addStationsToMap();
    });

    return () => {
      map.current?.remove();
    };
  }, [tokenValid, mapboxToken, stations, loading, lineFeatures]);

  useEffect(() => {
    // Update the ref whenever selectedStations changes
    selectedStationsRef.current = selectedStations;
    
    console.log('🔧 RouteMap useEffect - selectedStations changed:', selectedStations);
    console.log('🗺️ RouteMap - Station styles update:', {
      hasMap: !!map.current,
      stationsCount: stations.length,
      selectedCount: selectedStations.length,
      selectedStations: selectedStations
    });
    
    if (map.current && stations.length > 0) {
      updateStationStyles();
    }
  }, [selectedStations, stations, visits, activityStations]);

  // TfL official tube line colors
  const tubeLineColors: { [key: string]: string } = {
    'Bakerloo': '#B36305',
    'Central': '#E32017', 
    'Circle': '#FFD300',
    'District': '#00782A',
    'DLR': '#00A4A7',
    'Hammersmith & City': '#F3A9BB',
    'Jubilee': '#A0A5A9',
    'Metropolitan': '#9B0056',
    'Northern': '#000000',
    'Piccadilly': '#003688',
    'Victoria': '#0098D4',
    'Waterloo & City': '#95CDBA',
    'Elizabeth': '#7156A5',
    'London Overground': '#FF6600'
  };

  // Load line features from GeoJSON file
  const loadLinesFromGeoJSON = async () => {
    try {
      const response = await fetch('/data/stations.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch stations data: ${response.status}`);
      }
      
      const geojsonData = await response.json();
      
      // Get line features (LineString features)
      const lineFeatures = geojsonData.features.filter(
        (feature: any) => feature.geometry.type === 'LineString'
      );
      
      setLineFeatures(lineFeatures);
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
      setLineFeatures([]);
    }
  };

  const addTubeLinesToMap = () => {
    if (!map.current || lineFeatures.length === 0) return;
    
    lineFeatures.forEach((lineFeature, index) => {
      const lineName = lineFeature.properties.line_name || `Line-${index}`;
      const lineColor = lineFeature.properties.color || lineFeature.properties.stroke || '#666666';
      
      const sourceId = `tube-line-${lineName.replace(/\s+/g, '-').toLowerCase()}-${index}`;
      const layerId = `tube-line-${lineName.replace(/\s+/g, '-').toLowerCase()}-${index}`;

      try {
        // Check if source already exists and remove it
        if (map.current!.getSource(sourceId)) {
          map.current!.removeLayer(layerId);
          map.current!.removeSource(sourceId);
        }
        
        // Create GeoJSON for this line
        const lineGeoJSON = {
          type: 'FeatureCollection' as const,
          features: [lineFeature]
        };
        
        // Add source
        map.current!.addSource(sourceId, {
          type: 'geojson',
          data: lineGeoJSON
        });
        
        // Add line layer
        map.current!.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': lineColor,
            'line-width': lineFeature.properties['stroke-width'] || 4,
            'line-opacity': 0.8
          }
        });
      } catch (error) {
        console.error(`Error adding line layer ${layerId}:`, error);
      }
    });
  };

  const getStationVisitStatus = (stationId: string) => {
    const visit = visits.find(v => v.station_tfl_id === stationId);
    if (visit) {
      return visit.status; // Return the status directly since it's already 'verified' | 'pending' | 'rejected'
    }
    
    // Check if station is in activity sequence but not visited
    const isInActivitySequence = activityStations.includes(stationId);
    return isInActivitySequence ? 'not_visited' : 'not_in_sequence';
  };

  const isOffPlan = (stationId: string) => {
    // A station is off-plan if it's visited but not in the planned sequence
    const isVisited = visits.some(v => v.station_tfl_id === stationId);
    const isPlanned = activityStations.includes(stationId);
    return isVisited && !isPlanned;
  };

  const getStationSequenceNumber = (stationId: string) => {
    // For route creation/view mode (when activityMode is undefined), use selectedStations index
    if (activityMode === undefined) {
      const selectedIndex = selectedStations.indexOf(stationId);
      if (selectedIndex >= 0) {
        console.log(`🔢 Station ${stationId} sequence: ${selectedIndex + 1}`);
        return selectedIndex + 1;
      }
    } else {
      // For activity mode, prioritize visit sequence number over planned sequence
      const visit = visits.find(v => v.station_tfl_id === stationId);
      if (visit) {
        return visit.sequence_number; // Use actual visit sequence for visited stations
      }
      // For planned but unvisited stations, use planned sequence 
      const activityIndex = activityStations.indexOf(stationId);
      if (activityIndex >= 0) return activityIndex + 1;
    }
    
    console.log(`🔢 Station ${stationId} no sequence found`);
    return 0;
  };

  const addStationsToMap = () => {
    if (!map.current) return;

    // Add station source
    map.current.addSource('stations', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: stations.map(station => {
          const sequenceNumber = getStationSequenceNumber(station.id);
          const visitStatus = getStationVisitStatus(station.id);
          const isSelected = selectedStations.includes(station.id) || activityStations.includes(station.id);
          
          return {
            type: 'Feature' as const,
            properties: {
              id: station.id,
              name: station.name,
              zone: station.zone,
              sequence: sequenceNumber,
              isSelected: isSelected,
              visitStatus: visitStatus
            },
            geometry: {
              type: 'Point' as const,
              coordinates: station.coordinates
            }
          };
        })
      }
    });

    // Add station circles with visit status colors (red for visited, blue for planned, grey for others)
    map.current.addLayer({
      id: 'stations',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': [
          'case',
          ['get', 'isSelected'],
          14, // Larger for selected stations with numbers
          7
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'visitStatus'], 'verified'], '#dc143c', // Red - verified visited
          ['==', ['get', 'visitStatus'], 'pending'], '#dc143c', // Red - pending verification
          ['==', ['get', 'visitStatus'], 'not_visited'], '#4169e1', // Blue - planned but not visited
          ['get', 'isSelected'], '#4169e1', // Blue - selected in route creation
          '#9ca3af' // Grey - default
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1
      }
    });

    // Add station sequence numbers - these render ABOVE the station circles
    map.current.addLayer({
      id: 'station-numbers',
      type: 'symbol',
      source: 'stations',
      filter: ['>', ['get', 'sequence'], 0],
      layout: {
        'text-field': ['get', 'sequence'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 13,
        'text-anchor': 'center',
        'text-allow-overlap': true, // Ensure numbers are always visible
        'text-ignore-placement': true
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    });

    // Add station name labels for all stations
    map.current.addLayer({
      id: 'station-labels',
      type: 'symbol',
      source: 'stations',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.2],
        'text-max-width': 8,
        'text-allow-overlap': false,
        'text-ignore-placement': false
      },
      paint: {
        'text-color': '#333333',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    });

    // Add route connector lines
    if (selectedStations.length > 1) {
      if (activityMode) {
        addActivityPaths();
      } else {
        addRouteConnectorLines();
      }
    }

    // Add click handler (only if not read-only)
    if (!readOnly) {
      map.current.on('click', 'stations', (e) => {
        if (e.features && e.features[0]) {
          const stationId = e.features[0].properties?.id;
          const currentSelected = selectedStationsRef.current;
          console.log('🖱️ Station clicked:', stationId, 'Currently selected (from ref):', currentSelected);
          if (stationId) {
            // Check if station is already selected
            const isAlreadySelected = currentSelected.includes(stationId);
            console.log('🔍 Station', stationId, 'already selected?', isAlreadySelected);
            
            if (isAlreadySelected) {
              console.log('🗑️ Removing station:', stationId);
              onStationRemove(stationId);
            } else {
              console.log('➕ Adding station:', stationId, 'to existing selection:', currentSelected);
              onStationSelect(stationId);
            }
          }
        }
      });

      // Add context menu for start/finish selection (only if onStationSetRole is provided)
      if (onStationSetRole) {
        map.current.on('contextmenu', 'stations', (e) => {
          e.preventDefault();
          if (e.features && e.features[0]) {
            const stationId = e.features[0].properties?.id;
            const stationName = e.features[0].properties?.name;
            if (stationId && onStationSetRole) {
              // Create context menu
              const contextMenu = document.createElement('div');
              contextMenu.className = 'fixed bg-white border border-gray-300 rounded shadow-lg z-50 p-2 space-y-1';
              contextMenu.style.left = `${e.point.x}px`;
              contextMenu.style.top = `${e.point.y}px`;
              
              const setStartBtn = document.createElement('button');
              setStartBtn.className = 'block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded';
              setStartBtn.textContent = 'Set as Start';
              setStartBtn.onclick = () => {
                console.log('🏁 UI Bind: Setting start station:', { tfl_id: stationId, name: stationName });
                onStationSetRole!(stationId, 'start');
                document.body.removeChild(contextMenu);
              };
              
              const setFinishBtn = document.createElement('button');
              setFinishBtn.className = 'block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded';
              setFinishBtn.textContent = 'Set as Finish';
              setFinishBtn.onclick = () => {
                console.log('🏁 UI Bind: Setting finish station:', { tfl_id: stationId, name: stationName });
                onStationSetRole!(stationId, 'finish');
                document.body.removeChild(contextMenu);
              };
              
              contextMenu.appendChild(setStartBtn);
              contextMenu.appendChild(setFinishBtn);
              document.body.appendChild(contextMenu);
              
              // Remove context menu when clicking elsewhere
              const removeMenu = (evt: MouseEvent) => {
                if (!contextMenu.contains(evt.target as Node)) {
                  if (document.body.contains(contextMenu)) {
                    document.body.removeChild(contextMenu);
                  }
                  document.removeEventListener('click', removeMenu);
                }
              };
              setTimeout(() => document.addEventListener('click', removeMenu), 10);
            }
          }
        });
      }
    }

    // Change cursor on hover (only if not read-only)
    if (!readOnly) {
      map.current.on('mouseenter', 'stations', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'stations', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    }
  };

  const updateStationStyles = () => {
    if (!map.current || !map.current.getSource('stations')) return;

    // Update the source data with new sequence numbers and visit status
    const source = map.current.getSource('stations') as mapboxgl.GeoJSONSource;
    const updatedFeatures = stations.map(station => {
      const sequenceNumber = getStationSequenceNumber(station.id);
      const visitStatus = getStationVisitStatus(station.id);
      const isSelected = selectedStations.includes(station.id) || activityStations.includes(station.id);
      
      console.log(`🗺️ Updating station ${station.name}: sequence=${sequenceNumber}, selected=${isSelected}`);
      
      return {
        type: 'Feature' as const,
        properties: {
          id: station.id,
          name: station.name,
          zone: station.zone,
          sequence: sequenceNumber,
          isSelected: isSelected,
          visitStatus: visitStatus
        },
        geometry: {
          type: 'Point' as const,
          coordinates: station.coordinates
        }
      };
    });
    
    source.setData({
      type: 'FeatureCollection',
      features: updatedFeatures
    });

    console.log(`🗺️ Updated ${updatedFeatures.filter(f => f.properties.sequence > 0).length} stations with sequence numbers`);

    // Update layer styles with visit status colors (red for visited, blue for planned, grey for others)
    map.current.setPaintProperty('stations', 'circle-radius', [
      'case',
      ['get', 'isSelected'],
      14, // Larger for selected stations with numbers
      7
    ]);

    map.current.setPaintProperty('stations', 'circle-color', [
      'case',
      ['==', ['get', 'visitStatus'], 'verified'], '#dc143c', // Red - verified visited
      ['==', ['get', 'visitStatus'], 'pending'], '#dc143c', // Red - pending verification  
      ['==', ['get', 'visitStatus'], 'not_visited'], '#4169e1', // Blue - not yet visited
      ['get', 'isSelected'], '#4169e1', // Blue - selected in route creation
      '#9ca3af' // Grey - default
    ]);

    map.current.setPaintProperty('stations', 'circle-stroke-color', '#ffffff');

    map.current.setFilter('station-numbers', ['>', ['get', 'sequence'], 0]);
    
    // Update route connector lines
    if (selectedStations.length > 1) {
      if (activityMode) {
        addActivityPaths();
      } else {
        addRouteConnectorLines();
      }
    } else {
      // Clean up existing lines
      ['route-line', 'actual-path', 'preview-path'].forEach(layerId => {
        if (map.current!.getSource(layerId)) {
          if (map.current!.getLayer(layerId)) {
            map.current!.removeLayer(layerId);
          }
          map.current!.removeSource(layerId);
        }
      });
    }
  };

  const addRouteConnectorLines = () => {
    if (!map.current || selectedStations.length < 2) return;

    // Remove existing route line if it exists
    if (map.current.getSource('route-line')) {
      if (map.current.getLayer('route-line')) {
        map.current.removeLayer('route-line');
      }
      map.current.removeSource('route-line');
    }

    // Create line coordinates from selected stations
    const lineCoordinates: number[][] = [];
    selectedStations.forEach(stationId => {
      const station = stations.find(s => s.id === stationId);
      if (station) {
        lineCoordinates.push(station.coordinates);
      }
    });

    if (lineCoordinates.length < 2) return;

    // Add route line source
    map.current.addSource('route-line', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: lineCoordinates
        }
      }
    });

    // Add route line layer (dotted light grey reference line for planned routes)
    // Insert at the bottom so all station elements render above the path
    map.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route-line',
      paint: {
        'line-color': '#9ca3af', // Light grey
        'line-width': 3,
        'line-dasharray': [4, 6], // Short dashes for clear dotted appearance
        'line-opacity': 0.8
      }
    });
  };

  const addActivityPaths = () => {
    if (!map.current) return;

    // Clean up existing activity paths (including outline layers)
    ['actual-path', 'actual-path-outline', 'preview-path', 'preview-path-outline'].forEach(layerId => {
      if (map.current!.getSource(layerId) || map.current!.getLayer(layerId)) {
        try {
          if (map.current!.getLayer(layerId)) {
            map.current!.removeLayer(layerId);
          }
          if (map.current!.getSource(layerId)) {
            map.current!.removeSource(layerId);
          }
        } catch (error) {
          // Ignore errors for non-existent layers/sources
        }
      }
    });

    // Get visited stations in chronological order (including off-plan visits)
    const visitedStationsInOrder = visits
      .sort((a, b) => a.sequence_number - b.sequence_number)
      .map(v => v.station_tfl_id);

    // Add solid crimson path for actual visits
    if (visitedStationsInOrder.length >= 2) {
      const actualCoordinates: number[][] = [];
      visitedStationsInOrder.forEach(stationId => {
        const station = stations.find(s => s.id === stationId);
        if (station) {
          actualCoordinates.push(station.coordinates);
        }
      });

      if (actualCoordinates.length >= 2) {
        map.current.addSource('actual-path', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: actualCoordinates
            }
          }
        });

        map.current.addLayer({
          id: 'actual-path',
          type: 'line',
          source: 'actual-path',
          paint: {
            'line-color': '#9ca3af', // Light grey for visited path
            'line-width': 4,
            'line-opacity': 1
          }
        });
      }
    }

    // For planned activities, add dashed preview path from last visited to remaining planned
    if (activityMode === 'planned' && visitedStationsInOrder.length > 0) {
      const lastVisitedStation = visitedStationsInOrder[visitedStationsInOrder.length - 1];
      const lastVisitedCoords = stations.find(s => s.id === lastVisitedStation)?.coordinates;
      
      if (lastVisitedCoords) {
        // Get remaining planned stations that haven't been visited
        const remainingPlanned = activityStations.filter(stationId => 
          !visitedStationsInOrder.includes(stationId)
        );

        if (remainingPlanned.length > 0) {
          const previewCoordinates: number[][] = [lastVisitedCoords];
          
          remainingPlanned.forEach(stationId => {
            const station = stations.find(s => s.id === stationId);
            if (station) {
              previewCoordinates.push(station.coordinates);
            }
          });

          if (previewCoordinates.length >= 2) {
            map.current!.addSource('preview-path', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: previewCoordinates
                }
              }
            });

            map.current!.addLayer({
              id: 'preview-path',
              type: 'line',
              source: 'preview-path',
              paint: {
                'line-color': '#9ca3af', // Light grey for planned preview
                'line-width': 4,
                'line-opacity': 0.7,
                'line-dasharray': [4, 6] // Short dashes for clear dotted appearance
              }
            });
          }
        }
      }
    }
  };

  const getStationName = (stationId: string) => {
    return stations.find(s => s.id === stationId)?.name || stationId;
  };

  // Always show the map container - handle loading states within

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{readOnly ? 'Route Map (Read-Only)' : 'Route Map'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {readOnly 
              ? 'Interactive map showing the selected route stations.'
              : onStationSetRole 
                ? 'Click stations to add/remove from route. Right-click to set as start or finish station.' 
                : 'Click stations to add them to your route. Selected stations show sequence numbers.'
            }
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div ref={mapContainer} className="h-96 w-full rounded-lg border" style={{ minHeight: '400px' }} />
            
            {/* Show loading overlay or token setup */}
            {(!tokenValid || loading || stations.length === 0) && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center space-y-4 p-6">
                  {!tokenValid ? (
                    <>
                      <h3 className="font-semibold">Mapbox Setup Required</h3>
                      <p className="text-sm text-muted-foreground">
                        Enter your Mapbox public token from{' '}
                        <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          mapbox.com
                        </a>
                      </p>
                      <div className="flex gap-2 max-w-md">
                        <Input
                          placeholder="pk.your-mapbox-token-here"
                          value={mapboxToken}
                          onChange={(e) => setMapboxToken(e.target.value)}
                        />
                        <Button onClick={validateToken}>Set</Button>
                      </div>
                    </>
                  ) : loading ? (
                    <>
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground">Loading stations...</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading map data...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedStations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Route Sequence ({selectedStations.length} stations)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedStations.map((stationId, index) => (
                <div key={stationId} className="flex items-center justify-between p-2 bg-secondary rounded">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="font-medium">{getStationName(stationId)}</span>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1">
                      {index > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSequenceChange(index, index - 1)}
                        >
                          ↑
                        </Button>
                      )}
                      {index < selectedStations.length - 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSequenceChange(index, index + 1)}
                        >
                          ↓
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onStationRemove(stationId)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RouteMap;
