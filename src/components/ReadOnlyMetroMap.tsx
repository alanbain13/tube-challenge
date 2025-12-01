import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import emptyRoundel from "@/assets/roundel-empty.svg";
import filledRoundel from "@/assets/roundel-filled.svg";

const MAPBOX_TOKEN = "pk.eyJ1IjoiYWl2bWFpbiIsImEiOiJjbTRvMnV0YnYwd2RwMmlzOGEwdGsxcjN5In0.N7RfYGBBdtAG9zwLXYhBtw";

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

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

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

  useEffect(() => {
    if (!map.current || !mapLoaded || stations.length === 0) return;

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add markers for all stations
    stations.forEach((station) => {
      if (!map.current) return;

      const isVisited = verifiedVisits.includes(station.id);
      const el = document.createElement("div");
      el.className = "station-marker";
      el.style.backgroundImage = `url(${isVisited ? filledRoundel : emptyRoundel})`;
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.backgroundSize = "100%";
      el.style.cursor = "default";

      // Create popup content
      const popupContent = `
        <div class="p-2">
          <div class="font-semibold text-sm">${station.displayName}</div>
          <div class="text-xs text-muted-foreground mt-1">
            ${station.lines.join(", ")}
          </div>
          <div class="text-xs text-muted-foreground">Zone ${station.zone}</div>
          <div class="text-xs mt-1 font-medium ${isVisited ? 'text-green-600' : 'text-gray-500'}">
            ${isVisited ? '✓ Visited' : 'Not visited'}
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: "station-popup"
      }).setHTML(popupContent);

      new mapboxgl.Marker(el)
        .setLngLat(station.coordinates)
        .setPopup(popup)
        .addTo(map.current);
    });
  }, [mapLoaded, stations, verifiedVisits]);

  return (
    <div ref={mapContainer} className="w-full h-full min-h-[500px] rounded-lg" />
  );
}