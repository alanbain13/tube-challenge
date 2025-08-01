import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Station {
  id: string;
  tfl_id: string;
  name: string;
  latitude: number;
  longitude: number;
  zone: string;
  lines: string[];
}

interface StationVisit {
  id: string;
  station_id: string;
  visited_at: string;
}

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [stations, setStations] = useState<Station[]>([]);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load stations and visits
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load stations
        const { data: stationsData, error: stationsError } = await (supabase as any)
          .from('stations')
          .select('*');

        if (stationsError) throw stationsError;
        setStations(stationsData || []);

        // Load user visits if authenticated
        if (user) {
          const { data: visitsData, error: visitsError } = await (supabase as any)
            .from('station_visits')
            .select('*')
            .eq('user_id', user.id);

          if (visitsError) throw visitsError;
          setVisits(visitsData || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error loading map data",
          description: "Please try again later.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  // Initialize map when token is available
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || stations.length === 0) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-0.1278, 51.5074], // London center
      zoom: 10,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add stations to map
    map.current.on('load', () => {
      addStationsToMap();
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, stations, visits]);

  const addStationsToMap = () => {
    if (!map.current) return;

    // Create GeoJSON data for stations
    const stationsGeoJSON = {
      type: 'FeatureCollection' as const,
      features: stations.map((station) => {
        const isVisited = visits.some(visit => visit.station_id === station.id);
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [station.longitude, station.latitude]
          },
          properties: {
            id: station.id,
            name: station.name,
            zone: station.zone,
            lines: station.lines,
            visited: isVisited
          }
        };
      })
    };

    // Add source
    map.current!.addSource('stations', {
      type: 'geojson',
      data: stationsGeoJSON
    });

    // Add visited stations layer
    map.current!.addLayer({
      id: 'visited-stations',
      type: 'circle',
      source: 'stations',
      filter: ['==', ['get', 'visited'], true],
      paint: {
        'circle-radius': 8,
        'circle-color': '#10b981',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add unvisited stations layer
    map.current!.addLayer({
      id: 'unvisited-stations',
      type: 'circle',
      source: 'stations',
      filter: ['==', ['get', 'visited'], false],
      paint: {
        'circle-radius': 6,
        'circle-color': '#6b7280',
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add click handlers
    ['visited-stations', 'unvisited-stations'].forEach(layerId => {
      map.current!.on('click', layerId, (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const stationId = feature.properties?.id;
          const station = stations.find(s => s.id === stationId);
          if (station) {
            setSelectedStation(station);
          }
        }
      });

      // Change cursor on hover
      map.current!.on('mouseenter', layerId, () => {
        map.current!.getCanvas().style.cursor = 'pointer';
      });

      map.current!.on('mouseleave', layerId, () => {
        map.current!.getCanvas().style.cursor = '';
      });
    });
  };

  const toggleStationVisit = async (station: Station) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to track station visits.",
        variant: "destructive"
      });
      return;
    }

    const existingVisit = visits.find(visit => visit.station_id === station.id);

    try {
      if (existingVisit) {
        // Remove visit
        const { error } = await (supabase as any)
          .from('station_visits')
          .delete()
          .eq('id', existingVisit.id);

        if (error) throw error;

        setVisits(prev => prev.filter(v => v.id !== existingVisit.id));
        toast({
          title: "Visit removed",
          description: `Removed visit to ${station.name}`
        });
      } else {
        // Add visit
        const { data, error } = await (supabase as any)
          .from('station_visits')
          .insert({
            user_id: user.id,
            station_id: station.id
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setVisits(prev => [...prev, data]);
          toast({
            title: "Station visited!",
            description: `Added ${station.name} to your visited stations`
          });
        }
      }

      // Update map
      if (map.current) {
        const source = map.current.getSource('stations') as mapboxgl.GeoJSONSource;
        if (source) {
          const stationsGeoJSON = {
            type: 'FeatureCollection' as const,
            features: stations.map((s) => {
              const isVisited = s.id === station.id 
                ? !existingVisit 
                : visits.some(visit => visit.station_id === s.id && visit.station_id !== station.id);
              return {
                type: 'Feature' as const,
                geometry: {
                  type: 'Point' as const,
                  coordinates: [s.longitude, s.latitude]
                },
                properties: {
                  id: s.id,
                  name: s.name,
                  zone: s.zone,
                  lines: s.lines,
                  visited: isVisited
                }
              };
            })
          };
          source.setData(stationsGeoJSON);
        }
      }
    } catch (error) {
      console.error('Error toggling visit:', error);
      toast({
        title: "Error",
        description: "Failed to update station visit",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p>Loading map...</p>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold mb-4">Mapbox Token Required</h3>
        <p className="text-muted-foreground mb-4">
          Please enter your Mapbox public token to display the interactive map.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="pk.eyJ1..."
            className="flex-1 px-3 py-2 border rounded-md"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
          />
          <Button onClick={() => {
            if (mapboxToken.startsWith('pk.')) {
              toast({
                title: "Token added",
                description: "Map will load with your token"
              });
            } else {
              toast({
                title: "Invalid token",
                description: "Please enter a valid Mapbox public token",
                variant: "destructive"
              });
            }
          }}>
            Set Token
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Get your token from{' '}
          <a 
            href="https://mapbox.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            mapbox.com
          </a>
        </p>
      </div>
    );
  }

  const isStationVisited = selectedStation ? visits.some(visit => visit.station_id === selectedStation.id) : false;

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-96 rounded-lg" />
      
      {selectedStation && (
        <div className="absolute top-4 left-4 bg-card p-4 rounded-lg shadow-lg border max-w-sm">
          <h3 className="font-semibold text-lg">{selectedStation.name}</h3>
          <div className="flex gap-2 mt-2 mb-3">
            <Badge variant="outline">Zone {selectedStation.zone}</Badge>
            {selectedStation.lines.map(line => (
              <Badge key={line} variant="secondary" className="text-xs">
                {line}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => toggleStationVisit(selectedStation)}
              variant={isStationVisited ? "destructive" : "default"}
              size="sm"
            >
              {isStationVisited ? "Remove Visit" : "Mark as Visited"}
            </Button>
            <Button
              onClick={() => setSelectedStation(null)}
              variant="outline"
              size="sm"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-card p-3 rounded-lg shadow-lg border">
        <div className="text-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Visited ({visits.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Not Visited ({stations.length - visits.length})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;