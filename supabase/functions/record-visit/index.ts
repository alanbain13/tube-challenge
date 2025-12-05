import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client for database operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Default settings
const DEFAULT_GPS_RADIUS_METERS = 750;
const DEFAULT_PHOTO_MAX_AGE_SECONDS = 600;

/**
 * Fetch app settings from database
 */
async function getAppSettings(): Promise<{ gpsRadiusMeters: number; photoMaxAgeSeconds: number }> {
  try {
    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('key, value');

    if (error) {
      console.warn('⚠️ Could not fetch app settings, using defaults:', error.message);
      return {
        gpsRadiusMeters: DEFAULT_GPS_RADIUS_METERS,
        photoMaxAgeSeconds: DEFAULT_PHOTO_MAX_AGE_SECONDS
      };
    }

    const gpsRadius = settings?.find(s => s.key === 'GPS_RADIUS_METERS')?.value;
    const photoMaxAge = settings?.find(s => s.key === 'PHOTO_MAX_AGE_SECONDS')?.value;

    return {
      gpsRadiusMeters: gpsRadius ? parseInt(gpsRadius, 10) : DEFAULT_GPS_RADIUS_METERS,
      photoMaxAgeSeconds: photoMaxAge ? parseInt(photoMaxAge, 10) : DEFAULT_PHOTO_MAX_AGE_SECONDS
    };
  } catch (e) {
    console.warn('⚠️ Error fetching app settings:', e);
    return {
      gpsRadiusMeters: DEFAULT_GPS_RADIUS_METERS,
      photoMaxAgeSeconds: DEFAULT_PHOTO_MAX_AGE_SECONDS
    };
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * New verification status types
 */
type VerificationStatus = 'location_verified' | 'photo_verified' | 'remote_verified' | 'pending' | 'failed';

/**
 * Verification decision inputs
 */
interface VerificationInputs {
  // OCR results
  ocrPassed: boolean;
  stationNameMatched: boolean;
  
  // Timestamps
  photoTimestamp: Date | null;      // EXIF DateTimeOriginal
  loadTimestamp: Date;              // When uploaded to app
  
  // GPS coordinates
  photoGps: { lat: number; lng: number } | null;  // EXIF GPS
  loadGps: { lat: number; lng: number } | null;   // Device GPS at load time
  
  // Station target
  stationCoords: { lat: number; lng: number };
  
  // Configurable thresholds
  gpsRadiusMeters: number;
  photoMaxAgeSeconds: number;
}

interface VerificationDecision {
  verificationStatus: VerificationStatus;
  pendingReason: string | null;
  verificationMethod: string;
  timeDiffSeconds: number | null;
  gpsDistanceMeters: number | null;
  gpsSource: 'exif' | 'device' | 'none';
}

/**
 * New verification logic based on updated requirements:
 * 
 * 1. OCR + station name match must pass first (otherwise: failed)
 * 2. Check EXIF timestamp - if missing: remote_verified
 * 3. Calculate time diff between EXIF capture and load
 * 4. If time > PHOTO_MAX_AGE_SECONDS: remote_verified
 * 5. Check GPS (EXIF OR load GPS within GPS_RADIUS_METERS): location_verified
 * 6. Otherwise: photo_verified
 */
function deriveVerificationStatus(inputs: VerificationInputs): VerificationDecision {
  const {
    ocrPassed,
    stationNameMatched,
    photoTimestamp,
    loadTimestamp,
    photoGps,
    loadGps,
    stationCoords,
    gpsRadiusMeters,
    photoMaxAgeSeconds
  } = inputs;

  // Step 1: OCR + Station Name must pass
  if (!ocrPassed || !stationNameMatched) {
    return {
      verificationStatus: 'failed',
      pendingReason: !ocrPassed ? 'ocr_failed' : 'station_mismatch',
      verificationMethod: 'ai_image',
      timeDiffSeconds: null,
      gpsDistanceMeters: null,
      gpsSource: 'none'
    };
  }

  // Step 2: Check EXIF timestamp presence
  if (!photoTimestamp) {
    return {
      verificationStatus: 'remote_verified',
      pendingReason: 'no_exif_timestamp',
      verificationMethod: 'ai_image',
      timeDiffSeconds: null,
      gpsDistanceMeters: null,
      gpsSource: 'none'
    };
  }

  // Step 3: Calculate time difference
  const timeDiffSeconds = Math.abs(loadTimestamp.getTime() - photoTimestamp.getTime()) / 1000;

  // Step 4: Check time limit
  if (timeDiffSeconds > photoMaxAgeSeconds) {
    return {
      verificationStatus: 'remote_verified',
      pendingReason: 'time_exceeded',
      verificationMethod: 'ai_image',
      timeDiffSeconds: Math.round(timeDiffSeconds),
      gpsDistanceMeters: null,
      gpsSource: photoGps ? 'exif' : (loadGps ? 'device' : 'none')
    };
  }

  // Step 5: Check GPS (EITHER EXIF GPS or Load GPS within radius)
  let gpsSource: 'exif' | 'device' | 'none' = 'none';
  let gpsDistanceMeters: number | null = null;
  let gpsWithinRadius = false;

  // Check EXIF GPS first (preferred)
  if (photoGps && photoGps.lat && photoGps.lng) {
    const exifDistance = calculateDistanceMeters(
      photoGps.lat, photoGps.lng,
      stationCoords.lat, stationCoords.lng
    );
    gpsDistanceMeters = Math.round(exifDistance);
    gpsSource = 'exif';
    
    if (exifDistance <= gpsRadiusMeters) {
      gpsWithinRadius = true;
    }
  }

  // Check device GPS at load time (fallback)
  if (!gpsWithinRadius && loadGps && loadGps.lat && loadGps.lng) {
    const loadDistance = calculateDistanceMeters(
      loadGps.lat, loadGps.lng,
      stationCoords.lat, stationCoords.lng
    );
    
    // Update distance if we didn't have EXIF GPS or if device GPS is closer
    if (gpsSource === 'none' || loadDistance < (gpsDistanceMeters || Infinity)) {
      gpsDistanceMeters = Math.round(loadDistance);
      gpsSource = 'device';
    }
    
    if (loadDistance <= gpsRadiusMeters) {
      gpsWithinRadius = true;
      gpsSource = 'device';
    }
  }

  // Return location_verified if GPS is within radius
  if (gpsWithinRadius) {
    return {
      verificationStatus: 'location_verified',
      pendingReason: null,
      verificationMethod: 'gps',
      timeDiffSeconds: Math.round(timeDiffSeconds),
      gpsDistanceMeters,
      gpsSource
    };
  }

  // Step 6: Photo verified (OCR passed, time OK, but no GPS match)
  return {
    verificationStatus: 'photo_verified',
    pendingReason: null,
    verificationMethod: 'ai_image',
    timeDiffSeconds: Math.round(timeDiffSeconds),
    gpsDistanceMeters,
    gpsSource
  };
}

/**
 * Record visit request interface - updated with new fields
 */
interface RecordVisitRequest {
  activity_id: string;
  station_tfl_id: string;
  user_id: string;
  
  // OCR/AI verification results
  ocr_passed?: boolean;
  station_name_matched?: boolean;
  ai_station_text?: string;
  ai_confidence?: number;
  ai_verification_result?: any;
  
  // Photo timestamp (EXIF DateTimeOriginal)
  captured_at?: string | null;
  exif_time_present?: boolean;
  
  // Load timestamp (when photo was uploaded)
  loaded_at?: string;
  
  // EXIF GPS coordinates
  exif_lat?: number | null;
  exif_lng?: number | null;
  exif_gps_present?: boolean;
  
  // Device GPS at load time
  load_lat?: number | null;
  load_lon?: number | null;
  
  // Legacy location fields (for backward compatibility)
  latitude?: number | null;
  longitude?: number | null;
  visit_lat?: number | null;
  visit_lon?: number | null;
  
  // Image URL
  verification_image_url?: string;
  
  // Context flags
  verifier_version?: string;
  checkin_type?: 'gps' | 'image' | 'manual';
  
  // Legacy flags (for backward compatibility)
  simulation_mode?: boolean;
  ai_enabled?: boolean;
  has_connectivity?: boolean;
  geofence_result?: any;
  ocr_result?: any;
}

interface RecordVisitResponse {
  success: boolean;
  visit_id?: string;
  seq_actual?: number;
  verification_status?: VerificationStatus;
  verification_method?: string;
  error?: string;
  error_code?: string;
  duplicate?: {
    existing_visit_id: string;
    station_name: string;
    visited_at: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and extract authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('🚨 Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authentication required',
          error_code: 'unauthorized'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('🚨 Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token',
          error_code: 'unauthorized'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const visitData: RecordVisitRequest = await req.json();
    
    // Verify that the authenticated user matches the request user_id
    if (visitData.user_id && visitData.user_id !== user.id) {
      console.error('🚨 User ID mismatch:', { 
        authenticated: user.id, 
        requested: visitData.user_id 
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User ID does not match authenticated user',
          error_code: 'forbidden'
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use authenticated user ID (ignore any user_id in request body for security)
    const authenticatedUserId = user.id;
    
    console.log('🎯 Record Visit Request:', {
      activity_id: visitData.activity_id,
      station_tfl_id: visitData.station_tfl_id,
      user_id: authenticatedUserId,
      ocr_passed: visitData.ocr_passed,
      exif_time_present: visitData.exif_time_present,
      exif_gps_present: visitData.exif_gps_present,
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!visitData.activity_id || !visitData.station_tfl_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: activity_id, station_tfl_id',
          error_code: 'missing_fields'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch app settings
    const appSettings = await getAppSettings();
    console.log('⚙️ App Settings:', appSettings);

    // Check for duplicate visit
    const { data: existingVisit, error: duplicateError } = await supabase
      .from('station_visits')
      .select('id, visited_at, station_tfl_id')
      .eq('activity_id', visitData.activity_id)
      .eq('station_tfl_id', visitData.station_tfl_id)
      .eq('user_id', authenticatedUserId)
      .maybeSingle();

    if (existingVisit) {
      const { data: stationData } = await supabase
        .from('stations')
        .select('name')
        .eq('tfl_id', visitData.station_tfl_id)
        .maybeSingle();
      
      const stationName = stationData?.name || visitData.station_tfl_id;
      
      console.log('🚫 Duplicate visit detected:', {
        activity_id: visitData.activity_id,
        station_tfl_id: visitData.station_tfl_id,
        existing_visit_id: existingVisit.id
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Already checked in to ${stationName} for this activity.`,
          error_code: 'duplicate_visit',
          duplicate: {
            existing_visit_id: existingVisit.id,
            station_name: stationName,
            visited_at: existingVisit.visited_at
          }
        }),
        { 
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get station coordinates for geofence check
    const { data: stationData, error: stationError } = await supabase
      .from('stations')
      .select('latitude, longitude, name')
      .eq('tfl_id', visitData.station_tfl_id)
      .maybeSingle();

    if (stationError || !stationData) {
      console.error('🚨 Station not found:', visitData.station_tfl_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Station not found: ${visitData.station_tfl_id}`,
          error_code: 'station_not_found'
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get activity for cumulative duration calculation
    const { data: activityData } = await supabase
      .from('activities')
      .select('gate_start_at, started_at')
      .eq('id', visitData.activity_id)
      .maybeSingle();

    // Get next sequence number atomically
    const { data: maxSeqResult, error: seqError } = await supabase
      .from('station_visits')
      .select('seq_actual')
      .eq('activity_id', visitData.activity_id)
      .order('seq_actual', { ascending: false })
      .limit(1);

    if (seqError) {
      console.error('🚨 Error getting sequence number:', seqError);
      throw new Error(`Failed to get sequence number: ${seqError.message}`);
    }

    const nextSeqActual = (maxSeqResult && maxSeqResult.length > 0 && maxSeqResult[0].seq_actual) 
      ? maxSeqResult[0].seq_actual + 1 
      : 1;

    // Parse timestamps
    const loadTimestamp = visitData.loaded_at 
      ? new Date(visitData.loaded_at) 
      : new Date();
    
    const photoTimestamp = visitData.captured_at 
      ? new Date(visitData.captured_at) 
      : null;

    // Handle legacy OCR result format
    const ocrPassed = visitData.ocr_passed ?? visitData.ocr_result?.success ?? false;
    const stationNameMatched = visitData.station_name_matched ?? 
      (visitData.ai_station_text ? true : ocrPassed);

    // Parse GPS coordinates (support both new and legacy formats)
    const exifGps = (visitData.exif_lat && visitData.exif_lng) 
      ? { lat: visitData.exif_lat, lng: visitData.exif_lng }
      : (visitData.latitude && visitData.longitude && visitData.exif_gps_present)
        ? { lat: visitData.latitude, lng: visitData.longitude }
        : null;

    const loadGps = (visitData.load_lat && visitData.load_lon)
      ? { lat: visitData.load_lat, lng: visitData.load_lon }
      : (visitData.visit_lat && visitData.visit_lon)
        ? { lat: visitData.visit_lat, lng: visitData.visit_lon }
        : null;

    // Derive verification status
    const verificationDecision = deriveVerificationStatus({
      ocrPassed,
      stationNameMatched,
      photoTimestamp,
      loadTimestamp,
      photoGps: exifGps,
      loadGps,
      stationCoords: { 
        lat: Number(stationData.latitude), 
        lng: Number(stationData.longitude) 
      },
      gpsRadiusMeters: appSettings.gpsRadiusMeters,
      photoMaxAgeSeconds: appSettings.photoMaxAgeSeconds
    });

    console.log('📊 Verification Decision:', {
      inputs: {
        ocr_passed: ocrPassed,
        station_matched: stationNameMatched,
        photo_timestamp: photoTimestamp?.toISOString(),
        load_timestamp: loadTimestamp.toISOString(),
        exif_gps: exifGps,
        load_gps: loadGps,
        station_coords: { lat: stationData.latitude, lng: stationData.longitude }
      },
      decision: verificationDecision,
      settings: appSettings
    });

    // Calculate cumulative duration from activity start
    let cumulativeDurationSeconds: number | null = null;
    const activityStartTime = activityData?.gate_start_at || activityData?.started_at;
    if (activityStartTime) {
      const startTime = new Date(activityStartTime);
      cumulativeDurationSeconds = Math.round((loadTimestamp.getTime() - startTime.getTime()) / 1000);
      if (cumulativeDurationSeconds < 0) cumulativeDurationSeconds = 0;
    }

    // Prepare visit record with new verification fields
    const visitRecord = {
      id: crypto.randomUUID(),
      activity_id: visitData.activity_id,
      station_tfl_id: visitData.station_tfl_id,
      user_id: authenticatedUserId,
      seq_actual: nextSeqActual,
      
      // New verification status system
      verification_status: verificationDecision.verificationStatus,
      verification_method: verificationDecision.verificationMethod,
      
      // Legacy status field (for backward compatibility)
      status: verificationDecision.verificationStatus === 'failed' ? 'failed' : 'verified',
      pending_reason: verificationDecision.pendingReason,
      
      // Timestamps
      visited_at: loadTimestamp.toISOString(),
      captured_at: photoTimestamp?.toISOString() || null,
      loaded_at: loadTimestamp.toISOString(),
      created_at: new Date().toISOString(),
      
      // Time tracking
      time_diff_seconds: verificationDecision.timeDiffSeconds,
      cumulative_duration_seconds: cumulativeDurationSeconds,
      
      // GPS data
      latitude: exifGps?.lat || null,
      longitude: exifGps?.lng || null,
      load_lat: loadGps?.lat || null,
      load_lon: loadGps?.lng || null,
      visit_lat: loadGps?.lat || null,
      visit_lon: loadGps?.lng || null,
      geofence_distance_m: verificationDecision.gpsDistanceMeters,
      gps_source: verificationDecision.gpsSource,
      
      // EXIF flags
      exif_time_present: !!photoTimestamp,
      exif_gps_present: !!exifGps,
      
      // AI/OCR metadata
      ai_verification_result: visitData.ai_verification_result,
      ai_station_text: visitData.ai_station_text,
      ai_confidence: visitData.ai_confidence,
      verification_image_url: visitData.verification_image_url,
      
      // Context
      checkin_type: visitData.checkin_type || 'image',
      verifier_version: visitData.verifier_version || '2.0',
      is_simulation: false  // No longer supporting simulation mode in v2
    };

    // Insert the visit record
    const { data: insertedVisit, error: insertError } = await supabase
      .from('station_visits')
      .insert([visitRecord])
      .select('id, seq_actual, verification_status, status, visited_at')
      .single();

    if (insertError) {
      console.error('🚨 Insert error:', insertError);
      
      // Check for duplicate constraint violation (race condition)
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Already checked in to ${stationData.name} for this activity.`,
            error_code: 'duplicate_visit_race',
          }),
          { 
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      throw new Error(`Failed to insert visit: ${insertError.message}`);
    }

    // Update activity gate_start_at if this is the first visit
    if (nextSeqActual === 1 && !activityData?.gate_start_at) {
      await supabase
        .from('activities')
        .update({ gate_start_at: loadTimestamp.toISOString() })
        .eq('id', visitData.activity_id);
      
      console.log('⏱️ Set activity gate_start_at:', loadTimestamp.toISOString());
    }

    console.log('✅ Visit recorded successfully:', {
      visit_id: insertedVisit.id,
      seq_actual: insertedVisit.seq_actual,
      verification_status: insertedVisit.verification_status,
      station: stationData.name
    });

    const response: RecordVisitResponse = {
      success: true,
      visit_id: insertedVisit.id,
      seq_actual: insertedVisit.seq_actual,
      verification_status: insertedVisit.verification_status as VerificationStatus,
      verification_method: verificationDecision.verificationMethod
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('🚨 Record visit error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        error_code: 'server_error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
