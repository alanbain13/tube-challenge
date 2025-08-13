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
      addStationsToMap();
    });

    return () => {
      map.current?.remove();
    };
  }, [tokenValid, mapboxToken, stations, loading]);

  useEffect(() => {
    if (map.current && stations.length > 0) {
      updateStationStyles();
    }
  }, [selectedStations, stations]);

  const addStationsToMap = () => {
    if (!map.current) return;

    // Add station source
    map.current.addSource('stations', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: stations.map(station => ({
          type: 'Feature',
          properties: {
            id: station.id,
            name: station.name,
            zone: station.zone,
            sequence: selectedStations.indexOf(station.id) + 1
          },
          geometry: {
            type: 'Point',
            coordinates: station.coordinates
          }
        }))
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
          ['in', ['get', 'id'], ['literal', selectedStations]],
          8,
          5
        ],
        'circle-color': [
          'case',
          ['in', ['get', 'id'], ['literal', selectedStations]],
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
      filter: ['in', ['get', 'id'], ['literal', selectedStations]],
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
          onStationSelect(stationId);
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
      features: stations.map(station => ({
        type: 'Feature',
        properties: {
          id: station.id,
          name: station.name,
          zone: station.zone,
          sequence: selectedStations.indexOf(station.id) + 1
        },
        geometry: {
          type: 'Point',
          coordinates: station.coordinates
        }
      }))
    });

    // Update layer filters and styles
    map.current.setPaintProperty('stations', 'circle-color', [
      'case',
      ['in', ['get', 'id'], ['literal', selectedStations]],
      '#dc2626',
      '#3b82f6'
    ]);

    map.current.setPaintProperty('stations', 'circle-radius', [
      'case',
      ['in', ['get', 'id'], ['literal', selectedStations]],
      8,
      5
    ]);

    map.current.setFilter('station-numbers', ['in', ['get', 'id'], ['literal', selectedStations]]);
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