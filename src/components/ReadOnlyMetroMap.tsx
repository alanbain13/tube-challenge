import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import emptyRoundel from "@/assets/roundel-empty.svg";
import filledRoundel from "@/assets/roundel-filled.svg";

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
}

export default function ReadOnlyMetroMap({ 
  stations, 
  verifiedVisits,
  center = [-0.1276, 51.5074],
  zoom = 10
}: ReadOnlyMetroMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [lineFeatures, setLineFeatures] = useState<any[]>([]);

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
    });

    map.current.on("load", () => {
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
      // Use hardcoded TfL colors first (more accurate), then fall back to GeoJSON
      const lineColor = tubeLineColors[lineName] || lineFeature.properties.color || lineFeature.properties.stroke || '#666666';
      
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

  // Add station markers as GeoJSON layers
  useEffect(() => {
    if (!map.current || !mapLoaded || stations.length === 0) return;

    const sourceId = 'stations';
    const visitedLayerId = 'visited-stations';
    const unvisitedLayerId = 'unvisited-stations';

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
          displayName: station.displayName,
          zone: station.zone,
          lines: station.lines,
          visited: verifiedVisits.includes(station.id)
        }
      }))
    };

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

        // Add visited stations layer (filled red circles)
        map.current.addLayer({
          id: visitedLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['==', ['get', 'visited'], true],
          paint: {
            'circle-radius': 8,
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
  }, [mapLoaded, stations, verifiedVisits]);

  return (
    <div ref={mapContainer} className="w-full h-full min-h-[500px] rounded-lg" />
  );
}