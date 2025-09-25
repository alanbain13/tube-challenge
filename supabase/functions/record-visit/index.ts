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

/**
 * Status decision matrix based on A3.4 requirements
 */
interface StatusDecisionInputs {
  ocrResult?: {
    success: boolean;
    confidence: number;
    station_text_raw?: string;
  };
  geofenceResult?: {
    withinGeofence: boolean;
    distance: number | null;
    gpsSource: string;
  };
  simulationMode: boolean;
  aiEnabled: boolean;
  hasConnectivity: boolean;
}

interface StatusDecision {
  status: 'verified' | 'pending';
  pending_reason: string | null;
  verification_method: string;
}

function deriveVisitStatus(inputs: StatusDecisionInputs): StatusDecision {
  const { ocrResult, geofenceResult, simulationMode, aiEnabled, hasConnectivity } = inputs;
  
  // Simulation mode always verified
  if (simulationMode) {
    return {
      status: 'verified',
      pending_reason: null,
      verification_method: 'simulation'
    };
  }
  
  // No connectivity - mark as pending
  if (!hasConnectivity) {
    return {
      status: 'pending',
      pending_reason: 'no_connectivity',
      verification_method: 'offline'
    };
  }
  
  // AI disabled - manual verification
  if (!aiEnabled) {
    return {
      status: 'verified', // Manual check-ins are trusted
      pending_reason: null,
      verification_method: 'manual'
    };
  }
  
  // Check geofence first (location-based validation)
  if (geofenceResult && !geofenceResult.withinGeofence) {
    if (geofenceResult.gpsSource === 'none') {
      return {
        status: 'pending',
        pending_reason: 'no_gps_data',
        verification_method: 'ai_image'
      };
    } else {
      return {
        status: 'pending',
        pending_reason: 'geofence_failed',
        verification_method: 'ai_image'
      };
    }
  }
  
  // Check OCR result (AI-based validation)
  if (ocrResult && !ocrResult.success) {
    return {
      status: 'pending',
      pending_reason: 'ocr_failed',
      verification_method: 'ai_image'
    };
  }
  
  // Low confidence OCR
  if (ocrResult && ocrResult.confidence < 0.7) {
    return {
      status: 'pending',
      pending_reason: 'low_confidence',
      verification_method: 'ai_image'
    };
  }
  
  // All checks passed
  return {
    status: 'verified',
    pending_reason: null,
    verification_method: ocrResult ? 'ai_image' : 'gps'
  };
}

/**
 * Record visit interface
 */
interface RecordVisitRequest {
  activity_id: string;
  station_tfl_id: string;
  user_id: string;
  
  // Location data
  latitude?: number | null;
  longitude?: number | null;
  visit_lat?: number | null;
  visit_lon?: number | null;
  
  // EXIF and image data
  captured_at?: string;
  exif_time_present?: boolean;
  exif_gps_present?: boolean;
  gps_source?: 'exif' | 'device' | 'none';
  verification_image_url?: string;
  
  // Geofence data
  geofence_distance_m?: number | null;
  geofence_result?: {
    withinGeofence: boolean;
    distance: number | null;
    gpsSource: string;
  };
  
  // OCR/AI data
  ocr_result?: {
    success: boolean;
    confidence: number;
    station_text_raw?: string;
  };
  ai_verification_result?: any;
  ai_station_text?: string;
  ai_confidence?: number;
  
  // Resolver metadata
  resolver_rule?: string;
  resolver_score?: number;
  
  // Context flags
  simulation_mode?: boolean;
  ai_enabled?: boolean;
  has_connectivity?: boolean;
  checkin_type?: 'gps' | 'image' | 'manual';
  verifier_version?: string;
}

interface RecordVisitResponse {
  success: boolean;
  visit_id?: string;
  seq_actual?: number;
  status?: string;
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
    const visitData: RecordVisitRequest = await req.json();
    
    console.log('🎯 Record Visit Request:', {
      activity_id: visitData.activity_id,
      station_tfl_id: visitData.station_tfl_id,
      user_id: visitData.user_id,
      simulation_mode: visitData.simulation_mode,
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!visitData.activity_id || !visitData.station_tfl_id || !visitData.user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: activity_id, station_tfl_id, user_id',
          error_code: 'missing_fields'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check for duplicate visit (before any processing)
    const { data: existingVisit, error: duplicateError } = await supabase
      .from('station_visits')
      .select('id, visited_at, station_tfl_id')
      .eq('activity_id', visitData.activity_id)
      .eq('station_tfl_id', visitData.station_tfl_id)
      .eq('user_id', visitData.user_id)
      .single();

    if (existingVisit && !duplicateError) {
      // Get station name for user-friendly error
      const { data: stationData } = await supabase
        .from('stations')
        .select('name')
        .eq('tfl_id', visitData.station_tfl_id)
        .single();
      
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
          status: 409, // Conflict
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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

    console.log('🔢 Sequence assignment:', {
      activity_id: visitData.activity_id,
      next_seq_actual: nextSeqActual,
      max_existing: maxSeqResult?.[0]?.seq_actual || 0
    });

    // Derive status and pending reason
    const statusDecision = deriveVisitStatus({
      ocrResult: visitData.ocr_result,
      geofenceResult: visitData.geofence_result,
      simulationMode: visitData.simulation_mode || false,
      aiEnabled: visitData.ai_enabled !== false, // Default to true
      hasConnectivity: visitData.has_connectivity !== false // Default to true
    });

    console.log('📊 Status Decision:', {
      inputs: {
        ocr_success: visitData.ocr_result?.success,
        ocr_confidence: visitData.ocr_result?.confidence,
        geofence_within: visitData.geofence_result?.withinGeofence,
        geofence_distance: visitData.geofence_result?.distance,
        simulation_mode: visitData.simulation_mode,
        ai_enabled: visitData.ai_enabled
      },
      decision: statusDecision
    });

    // Prepare visit record
    const visitRecord = {
      id: crypto.randomUUID(),
      activity_id: visitData.activity_id,
      station_tfl_id: visitData.station_tfl_id,
      user_id: visitData.user_id,
      seq_actual: nextSeqActual,
      
      // Status and verification
      status: statusDecision.status,
      pending_reason: statusDecision.pending_reason,
      verification_method: statusDecision.verification_method,
      verifier_version: visitData.verifier_version || '1.0',
      
      // Location data
      latitude: visitData.latitude,
      longitude: visitData.longitude,
      visit_lat: visitData.visit_lat,
      visit_lon: visitData.visit_lon,
      
      // Timestamps
      visited_at: new Date().toISOString(),
      captured_at: visitData.captured_at || new Date().toISOString(),
      created_at: new Date().toISOString(),
      
      // EXIF and GPS metadata
      exif_time_present: visitData.exif_time_present || false,
      exif_gps_present: visitData.exif_gps_present || false,
      gps_source: visitData.gps_source || 'none',
      geofence_distance_m: visitData.geofence_distance_m,
      
      // AI and verification metadata
      ai_verification_result: visitData.ai_verification_result,
      ai_station_text: visitData.ai_station_text,
      ai_confidence: visitData.ai_confidence,
      verification_image_url: visitData.verification_image_url,
      
      // Resolver metadata (Implementation Rule 4)
      ocr_text: visitData.ocr_result?.station_text_raw,
      resolver_rule: visitData.resolver_rule,
      resolver_score: visitData.resolver_score,
      
      // Context
      checkin_type: visitData.checkin_type || 'image',
      is_simulation: visitData.simulation_mode || false
    };

    // Insert the visit record
    const { data: insertedVisit, error: insertError } = await supabase
      .from('station_visits')
      .insert([visitRecord])
      .select('id, seq_actual, status, visited_at')
      .single();

    if (insertError) {
      console.error('🚨 Insert error:', insertError);
      
      // Check if it's a duplicate constraint violation
      if (insertError.code === '23505') {
        // Race condition - another insert happened
        const { data: stationData } = await supabase
          .from('stations')
          .select('name')
          .eq('tfl_id', visitData.station_tfl_id)
          .single();
        
        const stationName = stationData?.name || visitData.station_tfl_id;
        
        return new Response(
          JSON.stringify({
            success: false,
            error: `Already checked in to ${stationName} for this activity.`,
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

    console.log('✅ Visit recorded successfully:', {
      visit_id: insertedVisit.id,
      seq_actual: insertedVisit.seq_actual,
      status: insertedVisit.status,
      activity_id: visitData.activity_id,
      station_tfl_id: visitData.station_tfl_id
    });

    const response: RecordVisitResponse = {
      success: true,
      visit_id: insertedVisit.id,
      seq_actual: insertedVisit.seq_actual,
      status: insertedVisit.status
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