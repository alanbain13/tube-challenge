import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || localStorage.getItem('mapbox_token') || '';

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

interface Station {
  id: string;
  name: string;
  displayName: string;
  lines: string[];
  zone: string;
  coordinates: [number, number];
}

interface ReadOnlyMetroMapProps {
  stations: Station[];
  verifiedVisits: string[]; // Array of station tfl_ids
  center?: [number, number];
  zoom?: number;
  showLegend?: boolean;
}

export default function ReadOnlyMetroMap({ 
  stations, 
  verifiedVisits,
  center = [-0.1276, 51.5074],
  zoom = 10,
  showLegend = true
}: ReadOnlyMetroMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [lineFeatures, setLineFeatures] = useState<any[]>([]);
  const networkBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);

  const visitedCount = verifiedVisits.length;
  const notVisitedCount = stations.length - visitedCount;

  // Load tube lines from GeoJSON
  useEffect(() => {
    const loadLinesFromGeoJSON = async () => {
      try {
        const response = await fetch('/data/stations.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch stations data: ${response.status}`);
        }
        
        const geojsonData = await response.json();
        
        // Get line features (LineString features)
        const lines = geojsonData.features.filter(
          (feature: any) => feature.geometry.type === 'LineString'
        );
        
        setLineFeatures(lines);
      } catch (error) {
        console.error('Error loading GeoJSON data:', error);
        setLineFeatures([]);
      }
    };

    loadLinesFromGeoJSON();
  }, []);

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

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token not found. Please add VITE_MAPBOX_TOKEN to your .env file.');
      return;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center,
      zoom,
      accessToken: MAPBOX_TOKEN,
      dragRotate: false,
      pitchWithRotate: false,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    map.current.scrollZoom.enable();

    map.current.on("load", () => {
      // Hide POIs and road labels for cleaner map
      const styleLayers = map.current!.getStyle().layers;
      styleLayers?.forEach((l) => {
        if (l.type === 'symbol' && (l.id.includes('poi') || l.id.includes('road'))) {
          try { map.current!.setLayoutProperty(l.id, 'visibility', 'none'); } catch {}
        }
      });

      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [center, zoom]);

  // Add tube lines to map
  useEffect(() => {
    if (!map.current || !mapLoaded || lineFeatures.length === 0) return;

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
  }, [mapLoaded, lineFeatures]);

  // Add station markers as GeoJSON layers (AFTER lines so they appear on top)
  useEffect(() => {
    if (!map.current || !mapLoaded || stations.length === 0) return;

    // Wait for lines to be added first
    const timer = setTimeout(() => {
      addStationsToMap();
    }, 100);

    return () => clearTimeout(timer);
  }, [mapLoaded, stations, verifiedVisits, lineFeatures]);

  const addStationsToMap = () => {
    if (!map.current) return;

    const sourceId = 'stations';
    const visitedLayerId = 'visited-stations';
    const unvisitedLayerId = 'unvisited-stations';
    const labelsLayerId = 'station-labels';

    // Create GeoJSON from stations
    const stationsGeoJSON = {
      type: 'FeatureCollection' as const,
      features: stations.map(station => ({
        type: 'Feature' as const,
        geometry: { 
          type: 'Point' as const, 
          coordinates: station.coordinates 
        },
        properties: {
          id: station.id,
          name: station.name,
          displayName: station.displayName,
          zone: station.zone,
          lines: station.lines,
          visited: verifiedVisits.includes(station.id)
        }
      }))
    };

    // Compute network bounds and add fit control
    const b = new mapboxgl.LngLatBounds();
    stations.forEach((s) => b.extend([s.coordinates[0], s.coordinates[1]]));
    networkBoundsRef.current = b;

    try {
      const source = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource;
      
      if (source) {
        // Update existing source data
        source.setData(stationsGeoJSON);
      } else {
        // Add source and layers for first time
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: stationsGeoJSON
        });

        // Add visited stations layer (filled red circles) - ON TOP of lines
        map.current.addLayer({
          id: visitedLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['==', ['get', 'visited'], true],
          paint: {
            'circle-radius': 7,
            'circle-color': '#E32017',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Add unvisited stations layer (white circles with red stroke)
        map.current.addLayer({
          id: unvisitedLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['==', ['get', 'visited'], false],
          paint: {
            'circle-radius': 6,
            'circle-color': '#ffffff',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#E32017'
          }
        });

        // Add station name labels
        map.current.addLayer({
          id: labelsLayerId,
          type: 'symbol',
          source: sourceId,
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

        // Add fit bounds control
        map.current.addControl(new FitBoundsControl(), 'top-left');

        // Fit to bounds initially
        if (!b.isEmpty()) {
          map.current.fitBounds(b, { padding: 40, duration: 0 });
        }

        // Add click handlers for both layers
        [visitedLayerId, unvisitedLayerId].forEach(layerId => {
          map.current!.on('click', layerId, (e) => {
            if (!e.features || !e.features[0]) return;

            const props = e.features[0].properties;
            const lines = JSON.parse(props.lines || '[]');
            
            // Categorize lines by type
            const tubeLines = ['Bakerloo', 'Central', 'Circle', 'District', 'Hammersmith & City', 
                               'Jubilee', 'Metropolitan', 'Northern', 'Piccadilly', 'Victoria', 'Waterloo & City'];
            
            const stationTubeLines = lines.filter((l: string) => tubeLines.includes(l));
            const stationOtherLines = lines.filter((l: string) => !tubeLines.includes(l));

            // Create popup content
            const popupContent = `
              <div class="p-2">
                <div class="font-semibold text-sm">${props.displayName}</div>
                ${stationTubeLines.length > 0 ? `<div class="text-xs text-muted-foreground mt-1">🚇 Tube: ${stationTubeLines.join(", ")}</div>` : ''}
                ${stationOtherLines.length > 0 ? `<div class="text-xs text-muted-foreground mt-0.5">🚆 ${stationOtherLines.join(", ")}</div>` : ''}
                <div class="text-xs text-muted-foreground mt-1">Zone ${props.zone}</div>
                <div class="text-xs mt-1 font-medium ${props.visited ? 'text-green-600' : 'text-gray-500'}">
                  ${props.visited ? '✓ Visited' : 'Not visited'}
                </div>
              </div>
            `;

            new mapboxgl.Popup({
              closeButton: false,
              className: "station-popup"
            })
              .setLngLat(e.lngLat)
              .setHTML(popupContent)
              .addTo(map.current!);
          });

          // Change cursor on hover
          map.current!.on('mouseenter', layerId, () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer';
          });

          map.current!.on('mouseleave', layerId, () => {
            if (map.current) map.current.getCanvas().style.cursor = '';
          });
        });
      }
    } catch (error) {
      console.error('Error adding station layers:', error);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <div ref={mapContainer} className="w-full h-full min-h-[500px] rounded-lg" />
      
      {/* Legend */}
      {showLegend && (
        <Card className="absolute bottom-4 left-4 p-3 bg-background/95 backdrop-blur-sm shadow-md z-10">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#E32017] border-2 border-white shadow-sm"></span>
              <span className="text-muted-foreground">Visited</span>
              <span className="font-medium ml-auto">{visitedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white border-[3px] border-[#E32017]"></span>
              <span className="text-muted-foreground">Not Visited</span>
              <span className="font-medium ml-auto">{notVisitedCount}</span>
            </div>
            <div className="pt-1 border-t text-xs text-muted-foreground">
              {stations.length} stations total
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}