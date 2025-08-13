import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useStations, Station } from '@/hooks/useStations';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface RouteMapProps {
  selectedStations: string[];
  onStationSelect: (stationId: string) => void;
  onStationRemove: (stationId: string) => void;
  onSequenceChange: (fromIndex: number, toIndex: number) => void;
}

const RouteMap: React.FC<RouteMapProps> = ({
  selectedStations,
  onStationSelect,
  onStationRemove,
  onSequenceChange
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [tokenValid, setTokenValid] = useState<boolean>(false);
  const [lineFeatures, setLineFeatures] = useState<any[]>([]);
  const { stations, loading } = useStations();

  // Check for existing token
  useEffect(() => {
    const savedToken = localStorage.getItem('mapbox_token');
    if (savedToken) {
      setMapboxToken(savedToken);
      setTokenValid(true);
    }
  }, []);

  const validateToken = () => {
    if (mapboxToken.startsWith('pk.')) {
      localStorage.setItem('mapbox_token', mapboxToken);
      setTokenValid(true);
    } else {
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
    console.log('🗺️ RouteMap - Station styles update:', {
      hasMap: !!map.current,
      stationsCount: stations.length,
      selectedCount: selectedStations.length
    });
    
    if (map.current && stations.length > 0) {
      updateStationStyles();
    }
  }, [selectedStations, stations]);

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

  const addStationsToMap = () => {
    if (!map.current) return;

    // Add station source
    map.current.addSource('stations', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: stations.map(station => {
          const sequenceIndex = selectedStations.indexOf(station.id);
          const sequence = sequenceIndex >= 0 ? sequenceIndex + 1 : 0;
          return {
            type: 'Feature',
            properties: {
              id: station.id,
              name: station.name,
              zone: station.zone,
              sequence: sequence,
              isSelected: sequenceIndex >= 0
            },
            geometry: {
              type: 'Point',
              coordinates: station.coordinates
            }
          };
        })
      }
    });

    // Add station circles
    map.current.addLayer({
      id: 'stations',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': [
          'case',
          ['get', 'isSelected'],
          8,
          5
        ],
        'circle-color': [
          'case',
          ['get', 'isSelected'],
          '#dc2626',
          '#3b82f6'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add station labels for selected stations
    map.current.addLayer({
      id: 'station-numbers',
      type: 'symbol',
      source: 'stations',
      filter: ['get', 'isSelected'],
      layout: {
        'text-field': ['get', 'sequence'],
        'text-font': ['Open Sans Bold'],
        'text-size': 12,
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Add click handler
    map.current.on('click', 'stations', (e) => {
      if (e.features && e.features[0]) {
        const stationId = e.features[0].properties?.id;
        if (stationId) {
          if (selectedStations.includes(stationId)) {
            onStationRemove(stationId);
          } else {
            onStationSelect(stationId);
          }
        }
      }
    });

    // Change cursor on hover
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
  };

  const updateStationStyles = () => {
    if (!map.current || !map.current.getSource('stations')) return;

    // Update the source data with new sequence numbers
    const source = map.current.getSource('stations') as mapboxgl.GeoJSONSource;
    source.setData({
      type: 'FeatureCollection',
      features: stations.map(station => {
        const sequenceIndex = selectedStations.indexOf(station.id);
        const sequence = sequenceIndex >= 0 ? sequenceIndex + 1 : 0;
        return {
          type: 'Feature',
          properties: {
            id: station.id,
            name: station.name,
            zone: station.zone,
            sequence: sequence,
            isSelected: sequenceIndex >= 0
          },
          geometry: {
            type: 'Point',
            coordinates: station.coordinates
          }
        };
      })
    });

    // Update layer filters and styles
    map.current.setPaintProperty('stations', 'circle-color', [
      'case',
      ['get', 'isSelected'],
      '#dc2626',
      '#3b82f6'
    ]);

    map.current.setPaintProperty('stations', 'circle-radius', [
      'case',
      ['get', 'isSelected'],
      8,
      5
    ]);

    map.current.setFilter('station-numbers', ['get', 'isSelected']);
  };

  const getStationName = (stationId: string) => {
    return stations.find(s => s.id === stationId)?.name || stationId;
  };

  if (!tokenValid) {
    return (
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
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p>Loading map...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Route Map</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click stations to add them to your route. Selected stations show sequence numbers.
          </p>
        </CardHeader>
        <CardContent>
          <div ref={mapContainer} className="h-96 rounded-lg" />
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