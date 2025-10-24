import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { buildMiniMapGeoJson } from '@/lib/miniMapUtils';

// LRU Cache for in-memory snapshots
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}

// Global in-memory cache
const snapshotCache = new LRUCache<string, string>(50);

// IndexedDB utilities
const DB_NAME = 'miniMapSnapshots';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;
const MAX_DB_ENTRIES = 50;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

const saveToIndexedDB = async (key: string, dataUrl: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Get current count and clean up if needed
    const countRequest = store.count();
    await new Promise((resolve) => {
      countRequest.onsuccess = async () => {
        if (countRequest.result >= MAX_DB_ENTRIES) {
          // Remove oldest entries
          const index = store.index('timestamp');
          const cursorRequest = index.openCursor();
          let deleteCount = countRequest.result - MAX_DB_ENTRIES + 1;
          
          cursorRequest.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result;
            if (cursor && deleteCount > 0) {
              store.delete(cursor.primaryKey);
              deleteCount--;
              cursor.continue();
            }
          };
        }
        resolve(null);
      };
    });
    
    // Save new entry
    await store.put({
      key,
      dataUrl,
      timestamp: Date.now()
    });
    
    db.close();
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
  }
};

const loadFromIndexedDB = async (key: string): Promise<string | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => {
        db.close();
        resolve(request.result?.dataUrl || null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Error loading from IndexedDB:', error);
    return null;
  }
};

interface UseMiniMapSnapshotOptions {
  type: 'route' | 'activity';
  id: string;
  stationSequence?: string[]; // For routes
  visitedStations?: Array<{ station_tfl_id: string; seq_actual: number }>; // For activities
  remainingStations?: Array<{ station_tfl_id: string; seq_planned: number }>; // For activities
  lastVisitAt?: string | null; // For cache invalidation
  updatedAt?: string; // For cache invalidation
  mapboxToken?: string;
}

export const useMiniMapSnapshot = (options: UseMiniMapSnapshotOptions) => {
  const {
    type,
    id,
    stationSequence,
    visitedStations = [],
    remainingStations = [],
    lastVisitAt,
    updatedAt,
    mapboxToken
  } = options;

  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  // Generate cache key
  const getCacheKey = (): string => {
    if (type === 'activity') {
      const visitedCount = visitedStations.length;
      const plannedCount = visitedStations.length + remainingStations.length;
      const lastVisit = lastVisitAt || '0';
      return `activity:${id}:${lastVisit}:${visitedCount}:${plannedCount}`;
    } else {
      const sequenceLength = stationSequence?.length || 0;
      const updated = updatedAt || '0';
      return `route:${id}:${updated}:${sequenceLength}`;
    }
  };

  // Generate snapshot
  const generateSnapshot = async (): Promise<string | null> => {
    if (!mapboxToken) {
      console.error('[MiniMapSnapshot] Mapbox token not available. Please set mapboxToken in localStorage with: localStorage.setItem("mapboxToken", "your_token_here")');
      return null;
    }

    console.log('[MiniMapSnapshot] Generating snapshot for:', { type, id, visitedCount: visitedStations?.length, remainingCount: remainingStations?.length });

    try {
      // Create offscreen container
      const offscreenContainer = document.createElement('div');
      offscreenContainer.style.width = '320px';
      offscreenContainer.style.height = '180px';
      offscreenContainer.style.position = 'absolute';
      offscreenContainer.style.left = '-9999px';
      document.body.appendChild(offscreenContainer);

      // Build GeoJSON data
      const geoJsonData = await buildMiniMapGeoJson({
        type,
        stationSequence: stationSequence || [],
        visitedStations,
        remainingStations
      });

      // Initialize map
      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: offscreenContainer,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-0.1276, 51.5074], // London center
        zoom: 10,
        preserveDrawingBuffer: true
      });

      await new Promise<void>((resolve) => {
        map.on('load', () => {
          // Add route lines
          if (geoJsonData.features.length > 0) {
            map.addSource('mini-route', {
              type: 'geojson',
              data: geoJsonData
            });

            // Add solid lines (visited for activities)
            if (type === 'activity' && visitedStations.length > 0) {
              map.addLayer({
                id: 'mini-route-visited',
                type: 'line',
                source: 'mini-route',
                filter: ['==', ['get', 'type'], 'visited'],
                paint: {
                  'line-color': '#9ca3af', // light grey
                  'line-width': 2
                }
              });
            }

            // Add dotted lines (planned/remaining or full route)
            map.addLayer({
              id: 'mini-route-planned',
              type: 'line',
              source: 'mini-route',
              filter: type === 'activity' ? 
                ['==', ['get', 'type'], 'planned'] : 
                ['==', ['get', 'type'], 'route'],
              paint: {
                'line-color': '#9ca3af', // light grey
                'line-width': 2,
                'line-dasharray': [2, 2]
              }
            });

            // Fit to route bounds
            const coordinates = geoJsonData.features.flatMap(f => 
              f.geometry.type === 'LineString' ? f.geometry.coordinates : []
            );
            
            if (coordinates.length > 0) {
              const bounds = coordinates.reduce(
                (bounds, coord) => bounds.extend(coord as [number, number]),
                new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number])
              );
              
              map.fitBounds(bounds, {
                padding: 20,
                maxZoom: 13
              });
            }
          }

          // Wait a bit for rendering
          setTimeout(resolve, 500);
        });
      });

      // Generate data URL
      const canvas = map.getCanvas();
      const dataUrl = canvas.toDataURL('image/png');

      console.log('[MiniMapSnapshot] Successfully generated snapshot');

      // Cleanup
      map.remove();
      document.body.removeChild(offscreenContainer);

      return dataUrl;
    } catch (error) {
      console.error('[MiniMapSnapshot] Error generating mini-map snapshot:', error);
      return null;
    }
  };

  // Load or generate snapshot
  useEffect(() => {
    if (!shouldLoad) {
      console.log('[MiniMapSnapshot] Not loading yet, waiting for intersection');
      return;
    }

    if (!mapboxToken) {
      console.log('[MiniMapSnapshot] Not loading yet, waiting for Mapbox token');
      return;
    }

    console.log('[MiniMapSnapshot] Starting snapshot load process', { type, id, mapboxToken: !!mapboxToken });

    const loadSnapshot = async () => {
      const cacheKey = getCacheKey();
      console.log('[MiniMapSnapshot] Cache key:', cacheKey);

      // Check in-memory cache first
      if (snapshotCache.has(cacheKey)) {
        console.log('[MiniMapSnapshot] Using cached snapshot from memory');
        setSnapshotUrl(snapshotCache.get(cacheKey)!);
        setIsLoading(false);
        return;
      }

      // Check IndexedDB
      const cachedUrl = await loadFromIndexedDB(cacheKey);
      if (cachedUrl) {
        console.log('[MiniMapSnapshot] Using cached snapshot from IndexedDB');
        snapshotCache.set(cacheKey, cachedUrl);
        setSnapshotUrl(cachedUrl);
        setIsLoading(false);
        return;
      }

      // Generate new snapshot
      console.log('[MiniMapSnapshot] No cached snapshot found, generating new one');
      const newUrl = await generateSnapshot();
      if (newUrl) {
        console.log('[MiniMapSnapshot] Snapshot generated successfully');
        snapshotCache.set(cacheKey, newUrl);
        await saveToIndexedDB(cacheKey, newUrl);
        setSnapshotUrl(newUrl);
      } else {
        console.error('[MiniMapSnapshot] Failed to generate snapshot');
      }
      setIsLoading(false);
    };

    loadSnapshot();
  }, [shouldLoad, id, JSON.stringify(visitedStations), JSON.stringify(remainingStations), lastVisitAt, updatedAt, mapboxToken]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) {
      console.log('[MiniMapSnapshot] No container ref yet');
      return;
    }

    console.log('[MiniMapSnapshot] Setting up IntersectionObserver');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          console.log('[MiniMapSnapshot] Intersection change:', { isIntersecting: entry.isIntersecting, target: entry.target });
          if (entry.isIntersecting && !shouldLoad) {
            console.log('[MiniMapSnapshot] Container is visible, triggering load');
            setShouldLoad(true);
          }
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(containerRef.current);

    return () => {
      console.log('[MiniMapSnapshot] Cleaning up IntersectionObserver');
      observer.disconnect();
    };
  }, [shouldLoad]);

  return {
    snapshotUrl,
    isLoading,
    containerRef
  };
};
