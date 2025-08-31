import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useStations, Station } from '@/hooks/useStations';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { UnifiedActivityState } from '@/hooks/useActivityState';
import { buildActivityGeoJSON, createPinSVG, createRoundelSVG } from '@/lib/activityMapUtils';

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
  activityMode?: 'planned' | 'unplanned';
  activityState?: UnifiedActivityState; // New prop for activity data
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
  activityMode = 'planned',
  activityState
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
      
      // Load pin and roundel images
      loadMapImages();
      
      // Use new pin system if activity state provided, otherwise fallback to old system
      if (activityState) {
        addActivityPinSystem();
      } else {
        addStationsToMap();
      }
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
      if (activityState) {
        updateActivityPinSystem();
      } else {
        updateStationStyles();
      }
    }
  }, [selectedStations, stations, visits, activityStations, activityState]);

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
    // For activity mode, prioritize visit sequence number over planned sequence
    if (activityMode) {
      const visit = visits.find(v => v.station_tfl_id === stationId);
      if (visit) {
        return visit.sequence_number; // Use actual visit sequence for visited stations
      }
      // For planned but unvisited stations, use planned sequence 
      const activityIndex = activityStations.indexOf(stationId);
      if (activityIndex >= 0) return activityIndex + 1;
    } else {
      // For route creation mode, use selectedStations index
      const selectedIndex = selectedStations.indexOf(stationId);
      if (selectedIndex >= 0) return selectedIndex + 1;
    }
    
    return 0;
  };

  const loadMapImages = () => {
    if (!map.current) return;

    // Create pin images for different states
    const pinConfigs = [
      { id: 'pin-visited', color: '#E53935', size: 34 },
      { id: 'pin-planned', color: '#1E88E5', size: 34 },
      { id: 'pin-pending', color: '#FB8C00', size: 34 },
      { id: 'pin-visited-small', color: '#E53935', size: 28 },
      { id: 'pin-planned-small', color: '#1E88E5', size: 28 },
      { id: 'pin-pending-small', color: '#FB8C00', size: 28 }
    ];

    pinConfigs.forEach(config => {
      const svg = createPinSVG(config.color, '1', config.size);
      const img = new Image();
      img.onload = () => {
        if (map.current) {
          map.current.addImage(config.id, img, { sdf: false });
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    });

    // Create roundel image
    const roundelSvg = createRoundelSVG(16);
    const roundelImg = new Image();
    roundelImg.onload = () => {
      if (map.current) {
        map.current.addImage('roundel-grey', roundelImg, { sdf: false });
      }
    };
    roundelImg.src = 'data:image/svg+xml;base64,' + btoa(roundelSvg);
  };

  const addActivityPinSystem = () => {
    if (!map.current || !activityState) return;

    const stationData = stations.map(s => ({
      id: s.id,
      name: s.name,
      coordinates: s.coordinates as [number, number]
    }));

    const geoData = buildActivityGeoJSON(activityState, stationData);

    // Add visited path (solid line with glow)
    map.current.addSource('activity-visited-path', {
      type: 'geojson',
      data: geoData.visitedPath
    });

    map.current.addLayer({
      id: 'activity-visited-path',
      type: 'line',
      source: 'activity-visited-path',
      paint: {
        'line-color': '#E53935',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11, 4,
          15, 6
        ]
      }
    });

    // Add visited path glow
    map.current.addLayer({
      id: 'activity-visited-path-glow',
      type: 'line',
      source: 'activity-visited-path',
      paint: {
        'line-color': '#ffffff',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11, 6,
          15, 8
        ],
        'line-opacity': 0.6
      }
    }, 'activity-visited-path');

    // Add planned path (dotted line)
    map.current.addSource('activity-planned-path', {
      type: 'geojson',
      data: geoData.plannedPath
    });

    map.current.addLayer({
      id: 'activity-planned-path',
      type: 'line',
      source: 'activity-planned-path',
      paint: {
        'line-color': '#9C27B0',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11, 3,
          15, 4
        ],
        'line-dasharray': [2, 3]
      }
    });

    // Add roundels for non-activity stations
    map.current.addSource('station-roundels', {
      type: 'geojson',
      data: geoData.roundels
    });

    map.current.addLayer({
      id: 'station-roundels',
      type: 'symbol',
      source: 'station-roundels',
      layout: {
        'icon-image': 'roundel-grey',
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 0.8,
          14, 1.2
        ],
        'icon-allow-overlap': false,
        'icon-ignore-placement': false
      }
    });

    // Add visited pins
    map.current.addSource('activity-visited-pins', {
      type: 'geojson',
      data: geoData.visitedPins
    });

    map.current.addLayer({
      id: 'activity-visited-pins',
      type: 'symbol',
      source: 'activity-visited-pins',
      layout: {
        'icon-image': [
          'case',
          ['<', ['zoom'], 12], 'pin-visited-small',
          'pin-visited'
        ],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11, 0.6,
          13, 0.8,
          15, 1.0
        ],
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'text-field': ['get', 'labelNum'],
        'text-font': ['Open Sans Bold'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11, 10,
          15, 14
        ],
        'text-anchor': 'center',
        'text-offset': [0, -1.8],
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#E53935',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    });

    // Add planned pins
    map.current.addSource('activity-planned-pins', {
      type: 'geojson',
      data: geoData.plannedPins
    });

    map.current.addLayer({
      id: 'activity-planned-pins',
      type: 'symbol',
      source: 'activity-planned-pins',
      layout: {
        'icon-image': [
          'case',
          ['<', ['zoom'], 12], 'pin-planned-small',
          'pin-planned'
        ],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11, 0.6,
          13, 0.8,
          15, 1.0
        ],
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'text-field': ['get', 'labelNum'],
        'text-font': ['Open Sans Bold'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11, 10,
          15, 14
        ],
        'text-anchor': 'center',
        'text-offset': [0, -1.8],
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#1E88E5',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    });

    // Add click handlers for pins
    ['activity-visited-pins', 'activity-planned-pins'].forEach(layerId => {
      map.current!.on('click', layerId, (e) => {
        if (e.features && e.features[0]) {
          const stationId = e.features[0].properties?.station_tfl_id;
          const stationName = e.features[0].properties?.station_name;
          
          // Create station info popup or handle tap
          new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            className: 'station-popup'
          })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="p-3">
              <h3 class="font-bold text-sm mb-1">${stationName}</h3>
              <p class="text-xs text-gray-600">Station ID: ${stationId}</p>
            </div>
          `)
          .addTo(map.current!);
        }
      });

      // Add cursor pointer
      map.current!.on('mouseenter', layerId, () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current!.on('mouseleave', layerId, () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    });
  };

  const updateActivityPinSystem = () => {
    if (!map.current || !activityState) return;

    const stationData = stations.map(s => ({
      id: s.id,
      name: s.name,
      coordinates: s.coordinates as [number, number]
    }));

    const geoData = buildActivityGeoJSON(activityState, stationData);

    // Update all sources with new data
    const sources = [
      { id: 'activity-visited-path', data: geoData.visitedPath },
      { id: 'activity-planned-path', data: geoData.plannedPath },
      { id: 'activity-visited-pins', data: geoData.visitedPins },
      { id: 'activity-planned-pins', data: geoData.plannedPins },
      { id: 'station-roundels', data: geoData.roundels }
    ];

    sources.forEach(({ id, data }) => {
      const source = map.current!.getSource(id) as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(data);
      }
    });
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
            type: 'Feature',
            properties: {
              id: station.id,
              name: station.name,
              zone: station.zone,
              sequence: sequenceNumber,
              isSelected: isSelected,
              visitStatus: visitStatus
            },
            geometry: {
              type: 'Point',
              coordinates: station.coordinates
            }
          };
        })
      }
    });

    // Add station circles with visit status colors (crimson for visited, royal blue for planned)
    map.current.addLayer({
      id: 'stations',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': [
          'case',
          ['get', 'isSelected'],
          10,
          6
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'visitStatus'], 'verified'], '#dc143c', // Crimson - verified visited
          ['==', ['get', 'visitStatus'], 'pending'], '#dc143c', // Crimson - pending verification
          ['==', ['get', 'visitStatus'], 'not_visited'], '#4169e1', // Royal blue - planned but not visited
          ['get', 'isSelected'], '#3b82f6', // Blue - selected in route creation
          '#9ca3af' // Gray - default
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1
      }
    });

    // Add numeric badges as separate overlay layer with better visibility
    map.current.addLayer({
      id: 'station-number-badges',
      type: 'circle',
      source: 'stations',
      filter: ['>', ['get', 'sequence'], 0],
      paint: {
        'circle-radius': 9,
        'circle-color': [
          'case',
          ['==', ['get', 'visitStatus'], 'verified'], '#1a1a1a', // Dark badge for visited
          ['==', ['get', 'visitStatus'], 'pending'], '#1a1a1a', // Dark badge for pending
          ['==', ['get', 'visitStatus'], 'not_visited'], '#4169e1', // Blue badge for planned
          '#1a1a1a' // Dark default
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-translate': [0, -8] // Offset badges from station dots
      }
    });

    // Add numeric text with white halo for readability
    map.current.addLayer({
      id: 'station-numbers',
      type: 'symbol',
      source: 'stations',
      filter: ['>', ['get', 'sequence'], 0],
      layout: {
        'text-field': ['get', 'sequence'],
        'text-font': ['Open Sans Bold'],
        'text-size': 12,
        'text-anchor': 'center',
        'text-offset': [0, -0.6] // Offset to match badge position
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
    source.setData({
      type: 'FeatureCollection',
      features: stations.map(station => {
        const sequenceNumber = getStationSequenceNumber(station.id);
        const visitStatus = getStationVisitStatus(station.id);
        const isSelected = selectedStations.includes(station.id) || activityStations.includes(station.id);
        
        return {
          type: 'Feature',
          properties: {
            id: station.id,
            name: station.name,
            zone: station.zone,
            sequence: sequenceNumber,
            isSelected: isSelected,
            visitStatus: visitStatus
          },
          geometry: {
            type: 'Point',
            coordinates: station.coordinates
          }
        };
      })
    });

    // Update layer styles with visit status colors (crimson for visited, royal blue for planned)
    map.current.setPaintProperty('stations', 'circle-color', [
      'case',
      ['==', ['get', 'visitStatus'], 'verified'], '#dc143c', // Crimson - verified visited
      ['==', ['get', 'visitStatus'], 'pending'], '#dc143c', // Crimson - pending verification  
      ['==', ['get', 'visitStatus'], 'not_visited'], '#4169e1', // Royal blue - not yet visited
      ['get', 'isSelected'], '#3b82f6', // Blue - selected in route creation
      '#9ca3af' // Gray - default
    ]);

    map.current.setPaintProperty('stations', 'circle-stroke-color', '#ffffff');

    // Update badge colors
    if (map.current.getLayer('station-number-badges')) {
      map.current.setPaintProperty('station-number-badges', 'circle-color', [
        'case',
        ['==', ['get', 'visitStatus'], 'verified'], '#1a1a1a', // Dark badge for visited
        ['==', ['get', 'visitStatus'], 'pending'], '#1a1a1a', // Dark badge for pending
        ['==', ['get', 'visitStatus'], 'not_visited'], '#4169e1', // Blue badge for planned
        '#1a1a1a' // Dark default
      ]);
    }

    map.current.setFilter('station-numbers', ['>', ['get', 'sequence'], 0]);
    if (map.current.getLayer('station-number-badges')) {
      map.current.setFilter('station-number-badges', ['>', ['get', 'sequence'], 0]);
    }
    
    // Update route connector lines
    if (selectedStations.length > 1) {
      if (activityMode) {
        addActivityPaths();
      } else {
        addRouteConnectorLines();
      }
    } else {
      // Clean up existing lines (including badge layers)
      ['route-line', 'actual-path', 'preview-path', 'actual-path-outline', 'preview-path-outline', 'station-number-badges'].forEach(layerId => {
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

    // Add route line layer (dotted grey reference line)
    map.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route-line',
      paint: {
        'line-color': '#9ca3af',
        'line-width': 3,
        'line-dasharray': [2, 2]
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

        // Add white outline for the actual path (lower z-index)
        map.current.addLayer({
          id: 'actual-path-outline',
          type: 'line',
          source: 'actual-path',
          paint: {
            'line-color': '#ffffff',
            'line-width': 6,
            'line-opacity': 0.9
          }
        });

        // Add actual path (higher z-index than outline)
        map.current.addLayer({
          id: 'actual-path',
          type: 'line',
          source: 'actual-path',
          paint: {
            'line-color': '#dc143c', // Crimson
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

            // Add white outline for preview path (lower z-index)
            map.current!.addLayer({
              id: 'preview-path-outline',
              type: 'line',
              source: 'preview-path',
              paint: {
                'line-color': '#ffffff',
                'line-width': 6,
                'line-opacity': 0.9,
                'line-dasharray': [2, 3]
              }
            });

            // Add preview path with contrasting purple color
            map.current!.addLayer({
              id: 'preview-path',
              type: 'line',
              source: 'preview-path',
              paint: {
                'line-color': '#9C27B0', // Purple - contrasting color that doesn't collide with tube lines
                'line-width': window.innerWidth < 768 ? 3 : 4, // Responsive width
                'line-opacity': 0.8,
                'line-dasharray': [2, 3] // Shorter dashes with clear gaps
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

  if (!tokenValid) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Mapbox Setup Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To use the interactive map, please enter your Mapbox public token.
              Get yours at <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">mapbox.com</a>
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="pk.your-mapbox-token-here"
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
              />
              <Button onClick={validateToken}>Set Token</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <p>Loading map...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div ref={mapContainer} className="h-96 w-full rounded-lg border" style={{ minHeight: '400px' }} />
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
