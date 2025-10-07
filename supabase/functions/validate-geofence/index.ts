import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default geofence radius (matches client-side config)
const DEFAULT_GEOFENCE_RADIUS_METERS = 750;

/**
 * Get geofence radius from environment or default
 */
function getGeofenceRadiusMeters(): number {
  const envRadius = Deno.env.get("GEOFENCE_RADIUS_METERS");
  if (envRadius) {
    const parsed = parseInt(envRadius, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_GEOFENCE_RADIUS_METERS;
}

/**
 * Calculate distance between two coordinates using Haversine formula
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

/**
 * Validate geofence server-side to prevent client tampering
 */
interface GeofenceValidationRequest {
  userLat: number;
  userLng: number;
  stationLat: number;
  stationLng: number;
  stationTflId: string;
  gpsSource: 'exif' | 'device' | 'none';
  clientDistance?: number; // For verification against client calculation
}

interface GeofenceValidationResponse {
  valid: boolean;
  distance: number;
  radiusUsed: number;
  gpsSource: string;
  serverCalculation: boolean;
  clientServerMatch?: boolean;
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userLat, 
      userLng, 
      stationLat, 
      stationLng, 
      stationTflId,
      gpsSource,
      clientDistance 
    }: GeofenceValidationRequest = await req.json();

    // Validate required parameters
    if (typeof userLat !== 'number' || typeof userLng !== 'number' ||
        typeof stationLat !== 'number' || typeof stationLng !== 'number' ||
        !stationTflId) {
      return new Response(
        JSON.stringify({ error: 'Missing required coordinates or station ID' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Server-side distance calculation
    const serverDistance = calculateDistance(userLat, userLng, stationLat, stationLng);
    const radius = getGeofenceRadiusMeters();
    const isValid = serverDistance <= radius;

    // Check if client and server calculations match (within 1m tolerance)
    let clientServerMatch: boolean | undefined;
    if (clientDistance !== undefined) {
      clientServerMatch = Math.abs(serverDistance - clientDistance) <= 1;
      
      // Log discrepancy if calculations don't match
      if (!clientServerMatch) {
        console.warn('🚨 Geofence calculation mismatch:', {
          stationTflId,
          clientDistance,
          serverDistance,
          difference: Math.abs(serverDistance - clientDistance),
          gpsSource,
          userCoords: { lat: userLat, lng: userLng },
          stationCoords: { lat: stationLat, lng: stationLng }
        });
      }
    }

    const response: GeofenceValidationResponse = {
      valid: isValid,
      distance: Math.round(serverDistance),
      radiusUsed: radius,
      gpsSource,
      serverCalculation: true,
      clientServerMatch,
      timestamp: new Date().toISOString()
    };

    // Log validation result for audit trail
    console.log('🎯 Server Geofence Validation:', {
      stationTflId,
      result: isValid ? 'PASS' : 'FAIL',
      distance: Math.round(serverDistance),
      radius,
      gpsSource,
      coordinates: {
        user: { lat: userLat, lng: userLng },
        station: { lat: stationLat, lng: stationLng }
      },
      clientMatch: clientServerMatch,
      timestamp: response.timestamp
    });

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('🚨 Geofence validation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during geofence validation',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});