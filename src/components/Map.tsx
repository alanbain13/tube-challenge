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
  name: string;
  latitude: number;
  longitude: number;
  zone: string;
  lines: string[];
}

interface StationVisit {
  id: string;
  station_id?: string; // Legacy column
  station_tfl_id?: string; // New column for TfL IDs
  visited_at: string;
}

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

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>(() => {
    return localStorage.getItem('mapbox_token') || '';
  });
  const [isTokenSet, setIsTokenSet] = useState<boolean>(() => {
    const savedToken = localStorage.getItem('mapbox_token');
    return Boolean(savedToken && savedToken.startsWith('pk.'));
  });
  const [stations, setStations] = useState<Station[]>([]);
  const [lineFeatures, setLineFeatures] = useState<any[]>([]);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load stations from GeoJSON file
  const loadStationsFromGeoJSON = async () => {
    try {
      console.log('🔄 Loading station data from GeoJSON...');
      
      const response = await fetch('/data/stations.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch stations data: ${response.status}`);
      }
      
      const geojsonData = await response.json();
      console.log('✅ Loaded GeoJSON data with', geojsonData.features.length, 'features');
      
      // Separate stations (Point features) and lines (LineString features)
      const stationFeatures = geojsonData.features.filter(
        (feature: any) => feature.geometry.type === 'Point'
      );
      const lineFeatures = geojsonData.features.filter(
        (feature: any) => feature.geometry.type === 'LineString'
      );
      
      console.log('📍 Found', stationFeatures.length, 'station features');
      console.log('🚇 Found', lineFeatures.length, 'line features');
      
      // Transform station features to our Station interface
      const transformedStations: Station[] = stationFeatures.map((feature: any) => ({
        id: feature.properties.id,
        name: feature.properties.name,
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
        zone: feature.properties.zone || '1',
        lines: feature.properties.lines?.map((line: any) => line.name) || []
      }));
      
      setStations(transformedStations);
      setLineFeatures(lineFeatures);
      
      console.log('✅ Successfully processed', transformedStations.length, 'stations');
    } catch (error) {
      console.error('❌ Error loading GeoJSON data:', error);
      toast({
        title: "Error loading station data",
        description: "Failed to load station data from GeoJSON file.",
        variant: "destructive"
      });
      setStations([]);
      setLineFeatures([]);
    }
  };

  // Load user visits
  const loadUserVisits = async () => {
    if (!user) return;
    
    try {
      console.log('🔄 Fetching station visits...');
      const { data, error } = await supabase
        .from('station_visits')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('❌ Error fetching visits:', error);
        return;
      }
      
      console.log('✅ Fetched visits:', data?.length || 0);
      setVisits(data || []);
    } catch (error) {
      console.error('❌ Error fetching station visits:', error);
    }
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStationsFromGeoJSON(),
        loadUserVisits()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Initialize map when token is set and data is loaded
  useEffect(() => {
    console.log('🗺️ Map useEffect triggered:', {
      hasContainer: !!mapContainer.current,
      hasToken: !!mapboxToken,
      isTokenSet,
      stationsCount: stations.length
    });

    if (!mapContainer.current || !mapboxToken || !isTokenSet || stations.length === 0) {
      console.log('❌ Map initialization blocked:', {
        container: !!mapContainer.current,
        token: !!mapboxToken,
        tokenSet: isTokenSet,
        stations: stations.length
      });
      return;
    }

    console.log('✅ Initializing Mapbox map...');
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-0.1278, 51.5074], // London center
      zoom: 10,
    });

    console.log('🗺️ Map created, adding controls...');

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add data to map when loaded
    map.current.on('load', () => {
      console.log('🗺️ Map loaded, adding data...');
      addTubeLinesToMap();
      addStationsToMap();
    });

    return () => {
      console.log('🗺️ Cleaning up map...');
      map.current?.remove();
    };
  }, [mapboxToken, isTokenSet, stations, visits, lineFeatures]);

  const addTubeLinesToMap = () => {
    if (!map.current || lineFeatures.length === 0) {
      console.log('❌ Cannot add tube lines - missing map or line data');
      return;
    }

    console.log('🚇 Adding tube lines from GeoJSON to map...');
    
    lineFeatures.forEach((lineFeature, index) => {
      const lineName = lineFeature.properties.line_name || `Line-${index}`;
      const lineColor = lineFeature.properties.color || lineFeature.properties.stroke || '#666666';
      
      console.log(`🎨 Processing line: ${lineName} with color: ${lineColor}`);
      
      const sourceId = `tube-line-${lineName.replace(/\s+/g, '-').toLowerCase()}-${index}`;
      const layerId = `tube-line-${lineName.replace(/\s+/g, '-').toLowerCase()}-${index}`;

      try {
        // Check if source already exists and remove it
        if (map.current!.getSource(sourceId)) {
          console.log(`🔄 Removing existing source: ${sourceId}`);
          map.current!.removeLayer(layerId);
          map.current!.removeSource(sourceId);
        }

        console.log(`➕ Adding source: ${sourceId}`);
        
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

        console.log(`➕ Adding layer: ${layerId}`);
        
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

        console.log(`✅ Successfully added layer: ${layerId}`);
      } catch (error) {
        console.error(`❌ Error adding line layer ${layerId}:`, error);
      }
    });
  };

  const addStationsToMap = () => {
    if (!map.current) return;

    console.log('🚉 Adding stations to map...', stations.length);

    // Create GeoJSON data for stations
    const stationsGeoJSON = {
      type: 'FeatureCollection' as const,
      features: stations.map((station) => {
        const isVisited = visits.some(visit => 
          visit.station_tfl_id === station.id || visit.station_id === station.id
        );
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [Number(station.longitude), Number(station.latitude)]
          },
          properties: {
            id: station.id,
            name: station.name,
            zone: station.zone,
            lines: station.lines || [],
            visited: isVisited
          }
        };
      })
    };

    console.log('📍 Created GeoJSON with', stationsGeoJSON.features.length, 'stations');

    // Add source
    map.current!.addSource('stations', {
      type: 'geojson',
      data: stationsGeoJSON
    });

    // Add visited stations layer - green circles
    map.current!.addLayer({
      id: 'visited-stations',
      type: 'circle',
      source: 'stations',
      filter: ['==', ['get', 'visited'], true],
      paint: {
        'circle-radius': 8,
        'circle-color': '#22c55e',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add unvisited stations layer - black/white nodes
    map.current!.addLayer({
      id: 'unvisited-stations',
      type: 'circle',
      source: 'stations',
      filter: ['==', ['get', 'visited'], false],
      paint: {
        'circle-radius': 6,
        'circle-color': '#000000',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    console.log('✅ Added station layers to map');

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

    // Check for existing visit using both new and legacy columns
    const existingVisit = visits.find(visit => 
      visit.station_tfl_id === station.id || visit.station_id === station.id
    );

    try {
      if (existingVisit) {
        // Remove visit
        const { error } = await supabase
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
        // Add visit using the new column
        const { data, error } = await supabase
          .from('station_visits')
          .insert({
            user_id: user.id,
            station_id: station.id, // Keep legacy column for compatibility
            station_tfl_id: station.id // Use new column for TfL IDs
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

      // Update map visualization
      if (map.current) {
        const source = map.current.getSource('stations') as mapboxgl.GeoJSONSource;
        if (source) {
          const stationsGeoJSON = {
            type: 'FeatureCollection' as const,
            features: stations.map((s) => {
              const isVisited = s.id === station.id 
                ? !existingVisit 
                : visits.some(visit => 
                    (visit.station_tfl_id === s.id || visit.station_id === s.id) && 
                    (visit.station_tfl_id !== station.id && visit.station_id !== station.id)
                  );
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

  if (!mapboxToken || !isTokenSet) {
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
          <Button 
            onClick={() => {
              if (mapboxToken.startsWith('pk.')) {
                localStorage.setItem('mapbox_token', mapboxToken);
                setIsTokenSet(true);
                toast({
                  title: "Token saved",
                  description: "Map will load with your token (saved for future sessions)"
                });
              } else {
                toast({
                  title: "Invalid token",
                  description: "Please enter a valid Mapbox public token",
                  variant: "destructive"
                });
              }
            }}
            disabled={!mapboxToken.trim()}
          >
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

  const isStationVisited = selectedStation ? visits.some(visit => 
    visit.station_tfl_id === selectedStation.id || visit.station_id === selectedStation.id
  ) : false;

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-96 rounded-lg" />
      
      {selectedStation && (
        <div className="absolute top-4 left-4 bg-card p-4 rounded-lg shadow-lg border max-w-sm">
          <h3 className="font-semibold text-lg">{selectedStation.name}</h3>
          <div className="flex gap-2 mt-2 mb-3">
            <Badge variant="outline">Zone {selectedStation.zone}</Badge>
            {selectedStation.lines.map(line => (
              <Badge 
                key={line} 
                variant="secondary" 
                className="text-xs text-white"
                style={{ 
                  backgroundColor: tubeLineColors[line] || '#6b7280',
                  color: line === 'Circle' || line === 'Hammersmith & City' ? '#000' : '#fff'
                }}
              >
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
          <div className="text-xs text-muted-foreground mt-1">
            GeoJSON data: {stations.length} stations, {lineFeatures.length} lines
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;