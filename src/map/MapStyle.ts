/**
 * Single source of truth for all map styling
 * Used by RouteMap, UnifiedActivityMap, and other map components
 */

// Color constants (A1 baseline)
export const MAP_COLORS = {
  // Station markers
  VISITED: '#E53935',      // Crimson for visited stations
  PLANNED: '#1E88E5',      // Royal blue for planned stations  
  OTHER: '#9ca3af',        // Grey for non-activity stations
  
  // Path lines
  ACTUAL_PATH: '#E53935',     // Solid crimson for actual path
  PREVIEW_PATH: '#9C27B0',    // Purple for dotted preview path
  
  // Text and outlines
  WHITE: '#ffffff',
  TEXT_HALO: '#ffffff'
} as const;

// Size constants
export const MAP_SIZES = {
  // Marker sizes
  MARKER_LARGE: 20,
  MARKER_SMALL: 16,
  MARKER_TEXT: 12,
  
  // Line widths
  PATH_WIDTH_MOBILE: 4,
  PATH_WIDTH_DESKTOP: 6,
  PATH_OUTLINE: 2,
  
  // Text
  TEXT_HALO_WIDTH: 2
} as const;

// Layer styling configurations
export const LAYER_STYLES = {
  // Visited stations (red circular markers with numbers)
  visitedMarker: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      10, MAP_SIZES.MARKER_SMALL,
      15, MAP_SIZES.MARKER_LARGE
    ],
    'circle-color': MAP_COLORS.VISITED,
    'circle-stroke-color': MAP_COLORS.WHITE,
    'circle-stroke-width': MAP_SIZES.PATH_OUTLINE
  },
  
  // Planned stations (blue circular markers with numbers)
  plannedMarker: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      10, MAP_SIZES.MARKER_SMALL,
      15, MAP_SIZES.MARKER_LARGE
    ],
    'circle-color': MAP_COLORS.PLANNED,
    'circle-stroke-color': MAP_COLORS.WHITE,
    'circle-stroke-width': MAP_SIZES.PATH_OUTLINE
  },
  
  // Other stations (grey small circles)
  otherMarker: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      10, 3,
      15, 6
    ],
    'circle-color': MAP_COLORS.OTHER,
    'circle-opacity': 0.6
  },
  
  // Actual path (solid line with white outline for visibility)
  actualPath: {
    'line-color': MAP_COLORS.ACTUAL_PATH,
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      11, MAP_SIZES.PATH_WIDTH_MOBILE,
      15, MAP_SIZES.PATH_WIDTH_DESKTOP
    ],
    'line-cap': 'round',
    'line-join': 'round'
  },
  
  // Actual path glow (white outline)
  actualPathGlow: {
    'line-color': MAP_COLORS.WHITE,
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      11, MAP_SIZES.PATH_WIDTH_MOBILE + 2,
      15, MAP_SIZES.PATH_WIDTH_DESKTOP + 2
    ],
    'line-opacity': 0.6,
    'line-cap': 'round',
    'line-join': 'round'
  },
  
  // Preview path (dotted purple line)
  previewPath: {
    'line-color': MAP_COLORS.PREVIEW_PATH,
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      11, MAP_SIZES.PATH_WIDTH_MOBILE,
      15, MAP_SIZES.PATH_WIDTH_DESKTOP
    ],
    'line-dasharray': [4, 6], // Short dashes with clear gaps
    'line-cap': 'round',
    'line-join': 'round'
  },
  
  // Station number labels
  stationNumberText: {
    'text-field': ['get', 'sequence_number'],
    'text-font': ['Open Sans Bold'],
    'text-size': [
      'interpolate', ['linear'], ['zoom'],
      10, 10,
      15, MAP_SIZES.MARKER_TEXT
    ],
    'text-color': MAP_COLORS.WHITE,
    'text-halo-color': MAP_COLORS.TEXT_HALO,
    'text-halo-width': MAP_SIZES.TEXT_HALO_WIDTH,
    'text-anchor': 'center',
    'text-allow-overlap': true
  }
} as const;

// Z-index/render order (bottom to top)
export const LAYER_ORDER = [
  'tube-lines',           // Base network lines (lowest)
  'other-stations',       // Non-activity stations  
  'actual-path-glow',     // White glow behind actual path
  'preview-path',         // Dotted preview line
  'actual-path',          // Solid actual line
  'visited-stations',     // Visited station markers
  'planned-stations',     // Planned station markers
  'station-labels'        // Station number labels (highest)
] as const;

export type LayerName = typeof LAYER_ORDER[number];
