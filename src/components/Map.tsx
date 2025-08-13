import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useStations } from '@/hooks/useStations';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import roundelEmpty from '@/assets/roundel-empty.svg';
import roundelFilled from '@/assets/roundel-filled.svg';

interface Station {
  id: string;
  name: string;
  zone: string;
  lines: Array<{ name: string; nightopened?: number }>;
  coordinates: [number, number];
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
  const { stations, loading: stationsLoading } = useStations();
  const [lineFeatures, setLineFeatures] = useState<any[]>([]);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const visitsRef = useRef<StationVisit[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    visitsRef.current = visits;
  }, [visits]);

  // Popup and bounds refs
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const networkBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);

  // Load roundel icons into the map style
  const loadRoundelImages = async () => {
    if (!map.current) return;
    const loadImage = (url: string, name: string) =>
      new Promise<void>((resolve, reject) => {
        if (!map.current) return resolve();
        if (map.current.hasImage(name)) return resolve();
        map.current.loadImage(url, (error, image) => {
          if (error || !image) return reject(error);
          if (!map.current) return resolve();
          map.current.addImage(name, image as any, { pixelRatio: 2 });
          resolve();
        });
      });

    await Promise.all([
      loadImage(roundelEmpty, 'roundel-empty'),
      loadImage(roundelFilled, 'roundel-filled'),
    ]);
  };

  // Simple custom control to fit to full network extent
  class FitBoundsControl implements mapboxgl.IControl {
    private _map?: mapboxgl.Map;
    private _container?: HTMLDivElement;

    onAdd(map: mapboxgl.Map) {
      this._map = map;
      const container = document.createElement('div');
      container.className = 'mapboxgl-ctrl-group mapboxgl-ctrl';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mapboxgl-ctrl-icon';
      button.title = 'Fit to full extent';
      button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9V3h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 9V3h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 15v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 15v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      button.onclick = () => {
        const b = networkBoundsRef.current;
        if (this._map && b) this._map.fitBounds(b, { padding: 40, duration: 600 });
      };
      container.appendChild(button);
      this._container = container;
      return container;
    }

    onRemove() {
      if (this._container && this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }
      this._map = undefined;
    }
  }

// Build popup HTML with status
const buildPopupHTML = (station: Station, isVisited: boolean) => {
  const badges = (station.lines || []).map((line) => {
    const lineName = line.name;
    const bg = tubeLineColors[lineName] || '#6b7280';
    const fg = (lineName === 'Circle' || lineName === 'Hammersmith & City') ? '#000' : '#fff';
    return `<span style="background:${bg};color:${fg};padding:2px 6px;border-radius:9999px;font-size:10px;">${lineName}</span>`;
  }).join(' ');

  const statusBg = isVisited ? '#DCFCE7' : '#F3F4F6';
  const statusBorder = isVisited ? '#86EFAC' : '#E5E7EB';
  const statusColor = isVisited ? '#166534' : '#374151';
  const statusText = isVisited ? 'Visited' : 'Not visited';

  return `
    <article style="font-family: ui-sans-serif, system-ui, -apple-system; font-size: 12px;">
      <header style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <h1 style="font-weight:600; font-size: 14px; margin:0;">${station.name}</h1>
        <span style="border:1px solid ${statusBorder};background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:9999px;font-size:11px;white-space:nowrap;">${statusText}</span>
      </header>
      <div style="opacity:.7; margin:6px 0;">Zone ${station.zone}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${badges}</div>
      <p style="opacity:.6;margin-top:6px;">Tip: tap the roundel to ${isVisited ? 'unmark' : 'mark'} as visited</p>
    </article>`;
};

  // Load line features from GeoJSON file
  const loadLinesFromGeoJSON = async () => {
    try {
      console.log('🔄 Loading line data from GeoJSON...');
      
      const response = await fetch('/data/stations.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch stations data: ${response.status}`);
      }
      
      const geojsonData = await response.json();
      console.log('✅ Loaded GeoJSON data with', geojsonData.features.length, 'features');
      
      // Get line features (LineString features)
      const lineFeatures = geojsonData.features.filter(
        (feature: any) => feature.geometry.type === 'LineString'
      );
      
      console.log('🚇 Found', lineFeatures.length, 'line features');
      setLineFeatures(lineFeatures);
      
      console.log('✅ Successfully processed', lineFeatures.length, 'lines');
    } catch (error) {
      console.error('❌ Error loading GeoJSON data:', error);
      toast({
        title: "Error loading line data",
        description: "Failed to load line data from GeoJSON file.",
        variant: "destructive"
      });
      setLineFeatures([]);
    }
  };

// Load user visits (enrich with tfl_id from stations for legacy rows)
const loadUserVisits = async () => {
  if (!user) return;
  
  try {
    console.log('🔄 Fetching station visits (with station relation)...');
    const { data, error } = await supabase
      .from('station_visits')
      .select('id, user_id, station_id, station_tfl_id, visited_at, stations ( tfl_id )')
      .eq('user_id', user.id);
    
    if (error) {
      console.error('❌ Error fetching visits:', error);
      return;
    }
    
    const normalized = (data || []).map((row: any) => ({
      id: row.id,
      station_id: row.station_id,
      station_tfl_id: row.station_tfl_id || row.stations?.tfl_id || null,
      visited_at: row.visited_at,
    })) as StationVisit[];
    
    console.log('✅ Fetched visits:', normalized.length);
    setVisits(normalized);
  } catch (error) {
    console.error('❌ Error fetching station visits:', error);
  }
};

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadLinesFromGeoJSON(),
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

    if (!mapContainer.current || !mapboxToken || !isTokenSet || stations.length === 0 || stationsLoading) {
      console.log('❌ Map initialization blocked:', {
        container: !!mapContainer.current,
        token: !!mapboxToken,
        tokenSet: isTokenSet,
        stations: stations.length,
        loading: stationsLoading
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
      dragRotate: false,
      pitchWithRotate: false,
    });

    console.log('🗺️ Map created, adding controls...');

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Re-enable standard scroll/trackpad zoom
    map.current.scrollZoom.enable();

    // Add data to map when loaded
    map.current.on('load', async () => {
      console.log('🗺️ Map loaded, styling and adding data...');

      // Minimal base map styling: hide POIs and most road labels to focus on Tube layers
      const styleLayers = map.current!.getStyle().layers;
      styleLayers?.forEach((l) => {
        if (l.type === 'symbol' && (l.id.includes('poi') || l.id.includes('road'))) {
          try { map.current!.setLayoutProperty(l.id, 'visibility', 'none'); } catch {}
        }
      });

      addTubeLinesToMap();
      addStationsToMap();

      // Compute network bounds and add a fit control
      const b = new mapboxgl.LngLatBounds();
      stations.forEach((s) => b.extend([s.coordinates[0], s.coordinates[1]]));
      networkBoundsRef.current = b;
      map.current!.addControl(new FitBoundsControl(), 'top-left');

      if (!b.isEmpty()) {
        map.current!.fitBounds(b, { padding: 40, duration: 0 });
      }
    });

    return () => {
      console.log('🗺️ Cleaning up map...');
      map.current?.remove();
    };
  }, [mapboxToken, isTokenSet, stations, stationsLoading]);

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
const isVisited = visitsRef.current.some(visit => 
  visit.station_tfl_id === station.id || visit.station_id === station.id
);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: station.coordinates
      },
      properties: {
        id: station.id,
        name: station.name,
        zone: station.zone,
        lines: station.lines?.map(l => l.name) || [],
        visited: isVisited
      }
    };
  })
};

    console.log('📍 Created GeoJSON with', stationsGeoJSON.features.length, 'stations');

    // Add or update source
    const existing = map.current!.getSource('stations') as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(stationsGeoJSON as any);
    } else {
      map.current!.addSource('stations', {
        type: 'geojson',
        data: stationsGeoJSON
      });
    }

    // Add symbol layer with roundel icons (empty vs filled)
    if (!map.current!.getLayer('stations-symbols')) {
      map.current!.addLayer({
        id: 'stations-symbols',
        type: 'symbol',
        source: 'stations',
        layout: {
          'icon-image': ['case', ['==', ['get', 'visited'], true], 'roundel-filled', 'roundel-empty'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 0.65, 16, 0.85],
          'icon-allow-overlap': true,
        }
      });
    }
    // Fallback circle layers with roundel-like appearance
    if (!map.current!.getLayer('visited-stations')) {
      map.current!.addLayer({
        id: 'visited-stations',
        type: 'circle',
        source: 'stations',
        filter: ['==', ['get', 'visited'], true],
        paint: {
          'circle-radius': 7,
          'circle-color': '#E32017',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    if (!map.current!.getLayer('unvisited-stations')) {
      map.current!.addLayer({
        id: 'unvisited-stations',
        type: 'circle',
        source: 'stations',
        filter: ['==', ['get', 'visited'], false],
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#E32017'
        }
      });
    }

    console.log('✅ Added station layers to map');

// Add click handlers
['stations-symbols', 'visited-stations', 'unvisited-stations'].forEach(layerId => {
  map.current!.on('click', layerId, (e) => {
    if (e.features && e.features[0]) {
      const feature = e.features[0] as mapboxgl.MapboxGeoJSONFeature;
      const stationId = (feature.properties as any)?.id as string;
      const station = stations.find(s => s.id === stationId);
      if (station) {
        setSelectedStation(station);

        const coords = (feature.geometry as any)?.coordinates || station.coordinates;
        const isVisitedNow = visitsRef.current.some(v => v.station_tfl_id === station.id || v.station_id === station.id);
        const html = buildPopupHTML(station, isVisitedNow);

        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 12, closeOnClick: true })
          .setLngLat(coords as [number, number])
          .setHTML(html)
          .addTo(map.current!);

        // Toggle visit on click
        void toggleStationVisit(station);
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

  const current = visitsRef.current;
  const existingVisit = current.find(v => v.station_tfl_id === station.id || v.station_id === station.id);

  try {
    let nextVisits: StationVisit[] = current;

    if (existingVisit) {
      const { error } = await supabase
        .from('station_visits')
        .delete()
        .eq('id', existingVisit.id);
      if (error) throw error;

      nextVisits = current.filter(v => v.id !== existingVisit.id);
      toast({
        title: "Visit removed",
        description: `Removed visit to ${station.name}`
      });
    } else {
      // Add visit using mapping to DB station UUID if available; otherwise fallback to TfL ID only
      let stationUuid: string | undefined;
      const { data: sRow } = await supabase
        .from('stations')
        .select('id')
        .eq('tfl_id', station.id)
        .maybeSingle();
      stationUuid = (sRow as any)?.id as string | undefined;

      if (!stationUuid) {
        const { data: mapRow } = await supabase
          .from('station_id_mapping')
          .select('uuid_id')
          .eq('tfl_id', station.id)
          .maybeSingle();
        stationUuid = (mapRow as any)?.uuid_id as string | undefined;
      }

      const insertPayload: any = {
        user_id: user.id,
        station_tfl_id: station.id,
      };
      if (stationUuid) insertPayload.station_id = stationUuid;

      const { data, error } = await supabase
        .from('station_visits')
        .insert(insertPayload)
        .select('id, station_id, station_tfl_id, visited_at')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const added: StationVisit = {
          id: data.id as any,
          station_id: data.station_id as any,
          station_tfl_id: (data as any).station_tfl_id ?? station.id,
          visited_at: (data as any).visited_at,
        };
        nextVisits = [...current, added];
        toast({
          title: 'Station visited!',
          description: `Added ${station.name} to your visited stations`,
        });
      }
    }

    setVisits(nextVisits);

    // Update map source using the new visit set
    if (map.current) {
      const source = map.current.getSource('stations') as mapboxgl.GeoJSONSource;
      if (source) {
        const stationsGeoJSON = {
          type: 'FeatureCollection' as const,
          features: stations.map((s) => {
            const isVisited = nextVisits.some(v => v.station_tfl_id === s.id || v.station_id === s.id);
            return {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: s.coordinates },
              properties: { id: s.id, name: s.name, zone: s.zone, lines: s.lines?.map(l => l.name) || [], visited: isVisited }
            };
          })
        };
        source.setData(stationsGeoJSON as any);
      }
    }

    // Update popup status if open
    if (popupRef.current) {
      const isVisitedNow = nextVisits.some(v => v.station_tfl_id === station.id || v.station_id === station.id);
      popupRef.current.setHTML(buildPopupHTML(station, isVisitedNow));
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

  if (loading || stationsLoading) {
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


  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-96 rounded-lg" />
      

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