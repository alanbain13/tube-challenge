import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StationDataUpload from './StationDataUpload';

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
  const [lineSequences, setLineSequences] = useState<{ [key: string]: any }>({});
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCustomData, setHasCustomData] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if we have custom station data in the database
  const checkForCustomData = async () => {
    try {
      const { data: dbStations, error } = await (supabase as any)
        .from('stations')
        .select('*')
        .limit(1);
      
      if (!error && dbStations && dbStations.length > 0) {
        // Check if this looks like custom data (not TfL format)
        const hasCustomFormat = dbStations.some((station: any) => 
          station.tfl_id?.startsWith('custom-') || 
          station.tfl_id?.startsWith('uploaded-')
        );
        setHasCustomData(hasCustomFormat);
      }
    } catch (error) {
      console.error('Error checking custom data:', error);
    }
  };

  const handleDataUploaded = async () => {
    setLoading(true);
    setHasCustomData(true);
    // Trigger a reload of the stations data
    loadData();
  };

  // Load stations and visits
  const loadData = async () => {
    try {
      // Load stations from database first
      console.log('Starting to load station data...');
      try {
        const { data: dbStations, error: dbError } = await (supabase as any)
          .from('stations')
          .select('*');
        
        if (dbError) {
          console.warn('Database error, falling back to TfL API:', dbError);
        }
        
        if (dbStations && dbStations.length > 0 && !dbError) {
          console.log(`✅ Using ${dbStations.length} stations from database`);
          setStations(dbStations);
          
          // Check if this is custom data
          const hasCustomFormat = dbStations.some((station: any) => 
            station.tfl_id?.startsWith('custom-') || 
            station.tfl_id?.startsWith('uploaded-')
          );
          setHasCustomData(hasCustomFormat);
          
          // Always try to get line sequences for tube lines, even with custom data
          try {
            console.log('🚇 Fetching line sequences...');
            const { data: tflData, error: tflError } = await supabase.functions.invoke('fetch-tfl-stations');
            if (tflData?.lineSequences) {
              console.log('✅ Got line sequences:', Object.keys(tflData.lineSequences));
              setLineSequences(tflData.lineSequences);
            } else {
              console.log('❌ No line sequences received');
            }
          } catch (error) {
            console.log('❌ Could not fetch line sequences:', error);
          }
        } else {
          // Otherwise, fetch from TfL API via our edge function
          console.log('📡 Fetching stations from TfL API...');
          const { data: tflData, error: tflError } = await supabase.functions.invoke('fetch-tfl-stations');
          
          if (tflError) {
            console.error('❌ TfL API error:', tflError);
            throw tflError;
          }
          
          if (tflData?.stations) {
            console.log(`✅ Successfully loaded ${tflData.stations.length} stations from TfL API`);
            setStations(tflData.stations);
            if (tflData?.lineSequences) {
              setLineSequences(tflData.lineSequences);
            }
          } else {
            console.error('❌ No station data received from TfL API');
            throw new Error('No station data received from TfL API');
          }
        }
      } catch (stationError) {
        console.error('❌ Error loading stations:', stationError);
        toast({
          title: "Error",
          description: "Failed to load station data. Please try refreshing the page.",
          variant: "destructive",
        });
      }

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

  useEffect(() => {
    checkForCustomData();
    loadData();
  }, [user, toast]);

  // Initialize map when token is set and validated
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

    // Add stations to map
    map.current.on('load', () => {
      console.log('🗺️ Map loaded, adding stations...');
      addStationsToMap();
    });

    return () => {
      console.log('🗺️ Cleaning up map...');
      map.current?.remove();
    };
  }, [mapboxToken, isTokenSet, stations, visits]);

  const addTubeLinesToMap = () => {
    if (!map.current || stations.length === 0) {
      console.log('❌ Cannot add tube lines - missing map or stations');
      return;
    }

    console.log('🚇 Drawing tube lines from station coordinates...');
    console.log('📊 Total stations available:', stations.length);

    // Group stations by line
    const stationsByLine: { [lineName: string]: Station[] } = {};
    
    stations.forEach(station => {
      console.log(`Station ${station.name} has lines:`, station.lines);
      if (station.lines && Array.isArray(station.lines)) {
        station.lines.forEach(line => {
          if (!stationsByLine[line]) {
            stationsByLine[line] = [];
          }
          stationsByLine[line].push(station);
        });
      }
    });

    console.log('📊 Found lines with stations:', Object.keys(stationsByLine));
    Object.entries(stationsByLine).forEach(([line, stations]) => {
      console.log(`${line}: ${stations.length} stations`);
    });

    // Draw lines for each tube line
    Object.entries(stationsByLine).forEach(([lineName, lineStations]) => {
      if (lineStations.length < 2) {
        console.log(`⚠️ Not enough stations for ${lineName}: ${lineStations.length}`);
        return;
      }

      console.log(`🚇 Processing ${lineName} line with ${lineStations.length} stations`);

      // Sort stations geographically (roughly west to east, then north to south)
      const sortedStations = [...lineStations].sort((a, b) => {
        const lonDiff = a.longitude - b.longitude;
        if (Math.abs(lonDiff) > 0.01) return lonDiff; // Prioritize longitude (west-east)
        return b.latitude - a.latitude; // Then latitude (north-south)
      });

      // Create coordinates array
      const coordinates = sortedStations.map(station => [
        Number(station.longitude),
        Number(station.latitude)
      ]);

      console.log(`✅ Creating line for ${lineName} with coordinates:`, coordinates.slice(0, 3), '...');

      const lineGeoJSON = {
        type: 'FeatureCollection' as const,
        features: [{
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: coordinates
          },
          properties: {
            line: lineName
          }
        }]
      };

      // Get line color
      const lineColor = tubeLineColors[lineName] || '#6b7280';
      console.log(`🎨 Line ${lineName} -> color: ${lineColor}`);

      const sourceId = `tube-line-${lineName.replace(/\s+/g, '-').toLowerCase()}`;
      const layerId = `tube-line-${lineName.replace(/\s+/g, '-').toLowerCase()}`;

      try {
        // Check if source already exists and remove it
        if (map.current!.getSource(sourceId)) {
          console.log(`🔄 Removing existing source: ${sourceId}`);
          map.current!.removeLayer(layerId);
          map.current!.removeSource(sourceId);
        }

        console.log(`➕ Adding source: ${sourceId}`);
        // Add source
        map.current!.addSource(sourceId, {
          type: 'geojson',
          data: lineGeoJSON
        });

        console.log(`➕ Adding layer: ${layerId}`);
        // Add line layer - put it BEFORE station layers so stations appear on top
        map.current!.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': lineColor,
            'line-width': 6,
            'line-opacity': 0.7
          }
        });

        console.log(`✅ Successfully added layer: ${layerId}`);
      } catch (error) {
        console.error(`❌ Error adding line layer ${layerId}:`, error);
      }
    });

    console.log('🚇 Finished drawing tube lines');
  };

  const addStationsToMap = () => {
    if (!map.current) return;

    console.log('🚉 Adding stations to map...', stations.length);
    
    // Debug: Check first few stations to see their structure
    if (stations.length > 0) {
      console.log('📊 Sample station data:', {
        first: stations[0],
        hasLines: stations[0]?.lines?.length > 0,
        linesType: typeof stations[0]?.lines,
        linesValue: stations[0]?.lines
      });
    }

    // Create GeoJSON data for stations
    const stationsGeoJSON = {
      type: 'FeatureCollection' as const,
      features: stations.map((station) => {
        const isVisited = visits.some(visit => visit.station_id === station.id);
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

    // Add tube lines first (under stations)
    addTubeLinesToMap();

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
          {hasCustomData && (
            <div className="text-xs text-muted-foreground mt-1">
              Using custom data
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Map;
