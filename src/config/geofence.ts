/**
 * Geofence configuration management for client and backend consistency
 */

// Default geofence radius as per A3 requirements
const DEFAULT_GEOFENCE_RADIUS_METERS = 750;

/**
 * Get the configured geofence radius in meters
 * Falls back to 750m default if not configured
 */
export function getGeofenceRadiusMeters(): number {
  // Check for environment variable first
  const envRadius = typeof window !== 'undefined' 
    ? import.meta.env.VITE_GEOFENCE_RADIUS_METERS
    : process.env.GEOFENCE_RADIUS_METERS;
  
  if (envRadius) {
    const parsed = parseInt(envRadius, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  
  return DEFAULT_GEOFENCE_RADIUS_METERS;
}

/**
 * Check if coordinates are within geofence radius of target
 */
export function isWithinGeofence(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters?: number
): { withinGeofence: boolean; distance: number } {
  const radius = radiusMeters || getGeofenceRadiusMeters();
  
  // Calculate distance using Haversine formula
  const R = 6371000; // Earth's radius in meters
  const dLat = (targetLat - userLat) * Math.PI / 180;
  const dLon = (targetLng - userLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(userLat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return {
    withinGeofence: distance <= radius,
    distance: Math.round(distance)
  };
}

/**
 * GPS source types for tracking provenance
 */
export type GPSSource = 'exif' | 'device' | 'none';

/**
 * Determine GPS source based on available data
 */
export function determineGPSSource(
  exifGPS: { lat: number; lng: number } | null,
  deviceGPS: { lat: number; lng: number } | null
): GPSSource {
  if (exifGPS) return 'exif';
  if (deviceGPS) return 'device';
  return 'none';
}

/**
 * Geofence validation result
 */
export interface GeofenceResult {
  withinGeofence: boolean;
  distance: number | null;
  gpsSource: GPSSource;
  coords: { lat: number; lng: number } | null;
  radiusUsed: number;
}

/**
 * Validate geofence with telemetry logging
 */
export function validateGeofence(
  exifGPS: { lat: number; lng: number } | null,
  deviceGPS: { lat: number; lng: number } | null,
  targetLat: number,
  targetLng: number,
  enableTelemetry: boolean = false
): GeofenceResult {
  const gpsSource = determineGPSSource(exifGPS, deviceGPS);
  const coords = exifGPS || deviceGPS;
  const radiusUsed = getGeofenceRadiusMeters();
  
  let result: GeofenceResult = {
    withinGeofence: false,
    distance: null,
    gpsSource,
    coords,
    radiusUsed
  };
  
  if (coords) {
    const geofenceCheck = isWithinGeofence(coords.lat, coords.lng, targetLat, targetLng, radiusUsed);
    result.withinGeofence = geofenceCheck.withinGeofence;
    result.distance = geofenceCheck.distance;
  }
  
  // Emit telemetry if enabled
  if (enableTelemetry) {
    console.log('🎯 Geofence Validation:', {
      result: result.withinGeofence ? 'PASS' : 'FAIL',
      distance: result.distance,
      radius: radiusUsed,
      gpsSource,
      targetCoords: { lat: targetLat, lng: targetLng },
      userCoords: coords,
      timestamp: new Date().toISOString()
    });
  }
  
  return result;
}