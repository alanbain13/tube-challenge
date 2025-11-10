/**
 * IndexedDB cache for generated thumbnails
 * Stores up to 200 thumbnails with LRU eviction
 */

const DB_NAME = 'roundel-thumbnails';
const STORE_NAME = 'thumbnails';
const MAX_CACHE_SIZE = 200;

interface ThumbnailEntry {
  visitId: string;
  dataUrl: string;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'visitId' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });

  return dbPromise;
}

export async function getThumbnailFromCache(visitId: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(visitId);
      request.onsuccess = () => {
        const entry = request.result as ThumbnailEntry | undefined;
        if (entry) {
          console.log('[Tile.Thumb] Cache hit for visit:', visitId);
          resolve(entry.dataUrl);
        } else {
          console.log('[Tile.Thumb] Cache miss for visit:', visitId);
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Tile.Thumb] Cache read error:', error);
    return null;
  }
}

export async function saveThumbnailToCache(visitId: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    
    // First, check cache size and evict oldest if needed
    await evictOldestIfNeeded(db);
    
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const entry: ThumbnailEntry = {
      visitId,
      dataUrl,
      timestamp: Date.now()
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    console.log('[Tile.Thumb] Saved to cache:', visitId);
  } catch (error) {
    console.error('[Tile.Thumb] Cache write error:', error);
  }
}

async function evictOldestIfNeeded(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  
  const count = await new Promise<number>((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  if (count >= MAX_CACHE_SIZE) {
    // Get oldest entries
    const index = store.index('timestamp');
    const entries: ThumbnailEntry[] = [];
    
    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && entries.length < (count - MAX_CACHE_SIZE + 10)) {
          entries.push(cursor.value);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
    
    // Delete oldest entries
    if (entries.length > 0) {
      const deleteTx = db.transaction(STORE_NAME, 'readwrite');
      const deleteStore = deleteTx.objectStore(STORE_NAME);
      
      for (const entry of entries) {
        deleteStore.delete(entry.visitId);
      }
      
      console.log(`[Tile.Thumb] Evicted ${entries.length} old thumbnails from cache`);
    }
  }
}
