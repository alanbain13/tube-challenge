import { Station } from "@/hooks/useStations";

export interface ResolvedStation {
  station_id: string;        // Our primary key (TfL ID from stations data)
  tfl_id: string;           // TfL ID for reference
  display_name: string;     // Unique display name with line disambiguation (e.g., "Paddington (Bakerloo, District)")
  base_name: string;        // Base station name without disambiguation
  lines: string[];          // List of line names
  coords: { lat: number; lon: number };
  source: "ocr" | "gps" | "manual";
  matching_rule: string;    // Which rule matched for logs
  confidence?: number;      // OCR confidence if available
}

interface MatchCandidate {
  station: Station;
  score: number;
  rule: string;
}

/**
 * Central Station Resolver
 * Takes OCR text/station name and returns canonical station data
 */
export function resolveStation(
  stationTextRaw: string,
  stationName: string | null,
  stations: Station[],
  userLocation?: { lat: number; lng: number }
): ResolvedStation | { error: string; suggestions: Station[] } {
  
  console.log('🎯 Station Resolver: Input:', { stationTextRaw, stationName, stationsCount: stations.length });
  
  if (!stations.length) {
    return { error: "No stations data available", suggestions: [] };
  }

  // Use the AI-provided station name if available, otherwise fallback to raw OCR text
  const searchText = stationName || stationTextRaw;
  if (!searchText?.trim()) {
    return { error: "No station text to match", suggestions: [] };
  }

  const candidates: MatchCandidate[] = [];
  const normalizedSearch = normalizeStationName(searchText);
  
  console.log('🎯 Station Resolver: Normalized search:', normalizedSearch);

  // Rule 1: Case-insensitive exact match against master name
  for (const station of stations) {
    const normalizedStation = normalizeStationName(station.name);
    if (normalizedStation === normalizedSearch) {
      candidates.push({
        station,
        score: 1.0,
        rule: "exact_match"
      });
    }
  }

  // Rule 2: Handle "Underground Station" suffix in both directions
  if (candidates.length === 0) {
    const searchWithoutSuffix = normalizedSearch.replace(/\s+(underground\s+)?station$/i, '').trim();
    const searchWithSuffix = normalizedSearch + ' underground station';
    
    for (const station of stations) {
      const normalizedStation = normalizeStationName(station.name);
      const stationWithoutSuffix = normalizedStation.replace(/\s+(underground\s+)?station$/i, '').trim();
      
      // Check plain name against suffixed and vice versa
      if (searchWithoutSuffix === normalizedStation || 
          normalizedSearch === stationWithoutSuffix ||
          searchWithSuffix === normalizedStation) {
        candidates.push({
          station,
          score: 0.95,
          rule: "suffix_match"
        });
      }
    }
  }

  // Rule 3: Fuzzy matching with high threshold
  if (candidates.length === 0) {
    for (const station of stations) {
      const similarity = calculateSimilarity(normalizedSearch, normalizeStationName(station.name));
      if (similarity >= 0.9) {
        candidates.push({
          station,
          score: similarity,
          rule: "fuzzy_match"
        });
      }
    }
  }

  // Rule 4: GPS-assisted matching (lower fuzzy threshold if near location) 
  if (candidates.length === 0 && userLocation) {
    for (const station of stations) {
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        station.coordinates[1], station.coordinates[0]
      );
      
      // Within 500m, use lower similarity threshold
      if (distance <= 500) {
        const similarity = calculateSimilarity(normalizedSearch, normalizeStationName(station.name));
        if (similarity >= 0.75) {
          candidates.push({
            station,
            score: similarity * 0.9, // Slightly lower score for GPS-assisted
            rule: "gps_assisted_fuzzy"
          });
        }
      }
    }
  }

  console.log('🎯 Station Resolver: Candidates found:', candidates.length);
  
  if (candidates.length === 0) {
    // Generate suggestions for near misses
    const suggestions = stations
      .map(station => ({
        station,
        similarity: calculateSimilarity(normalizedSearch, normalizeStationName(station.name))
      }))
      .filter(item => item.similarity >= 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.station);

    return {
      error: `Could not match station: ${stationTextRaw}`,
      suggestions
    };
  }

  // Sort by score and pick the best
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  
  console.log('🎯 Station Resolver: Winner:', {
    name: winner.station.name,
    rule: winner.rule,
    score: winner.score
  });

  const result = {
    station_id: winner.station.id,
    tfl_id: winner.station.id, // In our data structure, id IS the TfL ID
    display_name: winner.station.displayName || winner.station.name,
    base_name: winner.station.name,
    lines: winner.station.lines.map(l => l.name),
    coords: {
      lat: winner.station.coordinates[1],
      lon: winner.station.coordinates[0]
    },
    source: "ocr" as const,
    matching_rule: winner.rule
  };

  // Log the resolved result with special logging for Nine Elms
  if (result.display_name.toLowerCase().includes('nine elms')) {
    console.log(`Resolved Nine Elms -> ${result.tfl_id}`);
  }
  console.log(`Station resolved from "${stationTextRaw}" -> ID: ${result.station_id}, TfL ID: ${result.tfl_id}, Name: ${result.display_name}`);

  // Check for ties (multiple high-scoring candidates)
  const topCandidates = candidates.filter(c => c.score === winner.score);
  if (topCandidates.length > 1) {
    console.warn('🎯 Station Resolver: Multiple equally good matches found');
    return {
      error: `Multiple possible matches for: ${stationTextRaw}`,
      suggestions: topCandidates.slice(0, 3).map(c => c.station)
    };
  }

  return result;
}

/**
 * Normalize station name for consistent matching
 */
function normalizeStationName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common station suffixes that might be inconsistent
    .replace(/\s+(underground\s+)?station$/i, '')
    .replace(/\s+tube\s+station$/i, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Normalize dashes and hyphens  
    .replace(/[-–—]/g, ' ')
    // Normalize ampersand
    .replace(/&/g, 'and')
    // Remove apostrophes and quotes
    .replace(/[''`"]/g, '')
    // Remove other punctuation and special characters
    .replace(/[^\w\s]/g, '')
    // Final cleanup
    .trim();
}

/**
 * Calculate similarity between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate distance between two coordinates in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}