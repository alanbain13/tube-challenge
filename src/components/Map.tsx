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

// Tube line GeoJSON data - simplified line connections for major routes
const tubeLineRoutes: { [key: string]: number[][] } = {
  'Central': [
    [-0.518, 51.5139], // West Ruislip
    [-0.3118, 51.5207], // Ealing Broadway  
    [-0.2749, 51.5154], // Acton
    [-0.2437, 51.5074], // White City
    [-0.2089, 51.5074], // Shepherd's Bush
    [-0.1778, 51.5074], // Holland Park
    [-0.1628, 51.5074], // Notting Hill Gate
    [-0.1558, 51.5154], // Queensway
    [-0.1428, 51.5154], // Lancaster Gate
    [-0.1318, 51.5154], // Marble Arch
    [-0.1258, 51.5154], // Bond Street
    [-0.1198, 51.5154], // Oxford Circus
    [-0.1078, 51.5154], // Tottenham Court Road
    [-0.0978, 51.5154], // Holborn
    [-0.0878, 51.5154], // Chancery Lane
    [-0.0778, 51.5154], // St. Paul's
    [-0.0678, 51.5154], // Bank
    [-0.0578, 51.5154], // Liverpool Street
    [-0.0478, 51.5154], // Bethnal Green
    [-0.0378, 51.5154], // Mile End
    [0.0122, 51.5454], // Stratford
  ],
  'Piccadilly': [
    [-0.4889, 51.4706], // Heathrow T5
    [-0.4539, 51.4700], // Heathrow T2&3
    [-0.3679, 51.4831], // Hatton Cross
    [-0.2749, 51.4854], // Hounslow West
    [-0.2249, 51.4854], // Osterley
    [-0.1949, 51.4854], // Boston Manor
    [-0.1649, 51.4854], // Northfields
    [-0.1349, 51.4854], // South Ealing
    [-0.1049, 51.4854], // Acton Town
    [-0.0749, 51.4954], // Hammersmith
    [-0.0449, 51.5054], // Barons Court
    [-0.0149, 51.5154], // Earl's Court
    [0.0151, 51.5254], // South Kensington
    [0.0451, 51.5354], // Knightsbridge
    [0.0751, 51.5454], // Hyde Park Corner
    [0.1051, 51.5554], // Green Park
    [0.1351, 51.5654], // Piccadilly Circus
    [0.1651, 51.5754], // Leicester Square
    [0.1951, 51.5854], // Covent Garden
    [0.2251, 51.5954], // Holborn
    [0.2551, 51.6054], // Russell Square
    [0.2851, 51.6154], // King's Cross
  ]
};


const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [isTokenSet, setIsTokenSet] = useState<boolean>(false);
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
        // Load stations - try database first, then TfL API
        console.log('Starting to load station data...');
        try {
          const { data: dbStations, error: dbError } = await (supabase as any)
            .from('stations')
            .select('*');
          
          if (dbError) {
            console.warn('Database error, falling back to TfL API:', dbError);
          }
          
          // If we have a small number of stations (only Zone 1), try TfL API for all stations
          if (dbStations && dbStations.length > 0 && dbStations.length < 100 && !dbError) {
            console.log(`⚠️  Only ${dbStations.length} stations in database, fetching all stations from TfL API...`);
            try {
              const { data: tflData, error: tflError } = await supabase.functions.invoke('fetch-tfl-stations');
              
              if (tflError) {
                console.error('❌ TfL API error, falling back to database:', tflError);
                setStations(dbStations);
              } else if (tflData?.stations) {
                console.log(`✅ Successfully loaded ${tflData.stations.length} stations from TfL API`);
                setStations(tflData.stations);
              } else {
                console.warn('⚠️  No TfL data, using database stations');
                setStations(dbStations);
              }
            } catch (tflError) {
              console.error('❌ TfL API failed, using database stations:', tflError);
              setStations(dbStations);
            }
          } else if (dbStations && dbStations.length >= 100 && !dbError) {
            console.log(`✅ Using ${dbStations.length} stations from database`);
            setStations(dbStations);
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
              console.log('Sample station:', tflData.stations[0]);
              setStations(tflData.stations);
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

    loadData();
  }, [user, toast]);

  // Initialize map when token is set and validated
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !isTokenSet || stations.length === 0) return;

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
  }, [mapboxToken, isTokenSet, stations, visits]);

  const addTubeLinesToMap = () => {
    if (!map.current) return;

    // Add tube line data sources and layers
    Object.entries(tubeLineRoutes).forEach(([lineName, coordinates]) => {
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

      // Add source
      map.current!.addSource(`tube-line-${lineName}`, {
        type: 'geojson',
        data: lineGeoJSON
      });

      // Add line layer
      map.current!.addLayer({
        id: `tube-line-${lineName}`,
        type: 'line',
        source: `tube-line-${lineName}`,
        paint: {
          'line-color': tubeLineColors[lineName] || '#6b7280',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });
    });
  };

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
                setIsTokenSet(true);
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
        </div>
      </div>
    </div>
  );
};

export default Map;