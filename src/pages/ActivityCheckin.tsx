import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, MapPin, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useStations } from "@/hooks/useStations";
import { resolveStation, ResolvedStation } from "@/lib/stationResolver";
import { DevPanel, useSimulationMode } from "@/components/DevPanel";
import { SimulationBanner } from "@/components/SimulationBanner";
import { CheckinConfirmation } from "@/components/CheckinConfirmation";
import { RecentVisitsList } from "@/components/RecentVisitsList";
import { useImageUpload } from "@/hooks/useImageUpload";

// Configuration
const GEOFENCE_RADIUS_METERS = parseInt(import.meta.env.VITE_GEOFENCE_RADIUS_METERS || '500', 10);
const SIMULATION_MODE_ENV = import.meta.env.DEV || import.meta.env.VITE_SIMULATION_MODE === 'true';

// Types for validation pipeline
interface OCRResult {
  is_roundel: boolean;
  station_text_raw: string;
  station_name?: string;
  confidence: number;
}

interface ValidationLogEntry {
  step: 'ocr' | 'resolve' | 'geofence' | 'persist';
  station_text_raw?: string;
  resolved_display_name?: string;
  station_id?: string;
  user_lat?: number;
  user_lng?: number;
  station_lat?: number;
  station_lng?: number;
  distance_m?: number;
  geofence_radius_m?: number;
  geofence_passed?: boolean;
  geofence_bypassed?: boolean;
  simulation_mode_env?: boolean;
  simulation_mode_user?: boolean;
  simulation_mode_effective?: boolean;
  result: 'success' | 'error' | 'bypassed';
  error_code?: string;
  error_message?: string;
}

// Helper functions
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  console.log('🧭 Geofence: Distance calculation -', {
    user_coords: { lat: lat1, lng: lon1 },
    station_coords: { lat: lat2, lng: lon2 },
    distance_m: Math.round(distance),
    formula: 'haversine'
  });
  
  return distance;
};

const ActivityCheckin = () => {
  const { activityId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { stations } = useStations();
  const { simulationModeEnv, simulationModeUser, simulationModeEffective } = useSimulationMode();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCamera, setIsCamera] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{tfl_id: string, name: string}> | null>(null);
  const [geofenceError, setGeofenceError] = useState<{ 
    message: string; 
    code: string; 
    resolvedStation?: ResolvedStation; 
    distance?: number;
    ocrResult?: OCRResult;
  } | null>(null);
  
  // New state for enhanced features
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastConfirmation, setLastConfirmation] = useState<{
    stationName: string;
    timestamp: Date;
    sequenceNumber: number;
    imageUrl?: string;
  } | null>(null);
  const { uploadImage, isUploading } = useImageUpload();

  // Log simulation mode config on component mount
  useEffect(() => {
    console.log('🧭 Checkin: Config loaded -', { 
      GEOFENCE_RADIUS_METERS, 
      simulationModeEnv,
      simulationModeUser,
      simulationModeEffective,
      isDev: import.meta.env.DEV 
    });
  }, [simulationModeEnv, simulationModeUser, simulationModeEffective]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Location access denied:", error);
          toast({
            title: "Location access denied",
            description: "GPS checkin will not be available.",
            variant: "destructive",
          });
        }
      );
    }
  }, [toast]);

  // Fetch activity details
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          route:routes(name, description),
          station_visits(*)
        `)
        .eq("id", activityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!activityId,
  });

  // Fetch nearby stations
  const { data: nearbyStations = [] } = useQuery({
    queryKey: ["nearby-stations", location?.lat, location?.lng],
    queryFn: async () => {
      if (!location) return [];
      
      // Simple distance calculation (should be replaced with proper geospatial query)
      const { data, error } = await supabase
        .from("stations")
        .select("*");
      if (error) throw error;
      
      return data
        .map((station: any) => ({
          ...station,
          distance: Math.sqrt(
            Math.pow(station.latitude - location.lat, 2) + 
            Math.pow(station.longitude - location.lng, 2)
          ) * 111 // Rough km conversion
        }))
        .filter((station: any) => station.distance < 0.5) // Within 500m
        .sort((a: any, b: any) => a.distance - b.distance);
    },
    enabled: !!location,
  });

  // Helper function to check if station is already checked in
  const isStationAlreadyCheckedIn = (stationTflId: string): boolean => {
    if (!activity?.station_visits) return false;
    return activity.station_visits.some((visit: any) => 
      visit.station_tfl_id === stationTflId && (visit.status === 'visited' || visit.status === 'pending')
    );
  };

  // Get the next expected station in sequence (fixed to track planned stations properly)
  const getNextExpectedStation = (): string | null => {
    if (!activity?.station_tfl_ids || activity.station_tfl_ids.length === 0) return null;
    
    // Check if there's a pending verification - blocks new check-ins
    const pendingVisit = activity.station_visits?.find((visit: any) => visit.status === 'pending');
    if (pendingVisit) return null;
    
    // Find the first planned station that hasn't been visited yet (strict sequence)
    for (const plannedStationId of activity.station_tfl_ids) {
      const hasVerifiedVisit = activity.station_visits?.some((visit: any) => 
        visit.station_tfl_id === plannedStationId && visit.status === 'verified'
      );
      
      if (!hasVerifiedVisit) {
        const station = stations.find(s => s.id === plannedStationId);
        const sequence = activity.station_tfl_ids.indexOf(plannedStationId) + 1;
        console.log('Next expected station:', { 
          sequence, 
          tfl_id: plannedStationId, 
          name: station?.name || 'Unknown'
        });
        return plannedStationId;
      }
    }
    
    // All planned stations have been visited
    console.log('All planned stations completed');
    return null;
  };

  // Compute current activity progress for recompute logging
  const getActivityProgress = () => {
    const totalPlanned = activity?.station_tfl_ids?.length || 0;
    const visited = activity?.station_visits?.filter((v: any) => v.status === 'verified').length || 0;
    const pending = activity?.station_visits?.filter((v: any) => v.status === 'pending').length || 0;
    const nextExpected = getNextExpectedStation();
    const nextStation = nextExpected ? stations.find(s => s.id === nextExpected) : null;
    const nextSequence = nextExpected && activity?.station_tfl_ids ? 
      activity.station_tfl_ids.indexOf(nextExpected) + 1 : null;
    
    console.log(`Recompute: total=${totalPlanned} visited=${visited} pending=${pending} next=${nextSequence ? `#${nextSequence}:${nextStation?.name || 'Unknown'}` : 'none'}`);
    
    return { totalPlanned, visited, pending, nextExpected, nextStation, nextSequence };
  };

  // Log activity progress on data changes
  useEffect(() => {
    if (activity && stations.length > 0) {
      getActivityProgress();
    }
  }, [activity?.station_visits, stations]);

  // Check if a station check-in is allowed (sequential enforcement)
  const isStationCheckinAllowed = (stationTflId: string): { allowed: boolean; reason?: string; expectedStation?: string } => {
    // Check if there's already a pending verification
    const pendingVisit = activity?.station_visits?.find((visit: any) => visit.status === 'pending');
    if (pendingVisit) {
      const pendingStation = stations.find(s => s.id === pendingVisit.station_tfl_id);
      return { 
        allowed: false, 
        reason: `Finish or cancel the current verification at ${pendingStation?.name || 'previous station'} before checking into another station.`,
        expectedStation: undefined
      };
    }
    
    // If no station sequence is defined, allow any station
    if (!activity?.station_tfl_ids || activity.station_tfl_ids.length === 0) {
      return { allowed: true };
    }
    
    // Check if station is already successfully checked in
    const isAlreadyVisited = activity.station_visits?.some((visit: any) => 
      visit.station_tfl_id === stationTflId && visit.status === 'verified'
    );
    
    if (isAlreadyVisited) {
      return { 
        allowed: false, 
        reason: 'Station already successfully checked in',
        expectedStation: getNextExpectedStation() || undefined
      };
    }

      // Check if this station is in the planned route
      if (!activity.station_tfl_ids.includes(stationTflId)) {
        const attemptedStationName = stations.find(s => s.id === stationTflId)?.name || stationTflId;
        const nextExpected = getNextExpectedStation();
        const expectedStationName = nextExpected ? 
          stations.find(s => s.id === nextExpected)?.name || nextExpected : 
          'None (route completed)';
        
        console.log(`🚫 Station ${attemptedStationName} not on planned route. Expected: ${expectedStationName}`);
        return { 
          allowed: false, 
          reason: `${attemptedStationName} is not on your planned route. Next required station: ${expectedStationName}`,
          expectedStation: nextExpected || undefined
        };
      }

    // Get the next expected station (strict sequence)
    const nextExpected = getNextExpectedStation();
    if (!nextExpected) {
      return { 
        allowed: false, 
        reason: 'All planned stations completed! You can finish the activity.',
        expectedStation: undefined
      };
    }

    // Only allow check-in at the next expected station (strict sequence)
    const isAllowed = nextExpected === stationTflId;
    if (!isAllowed) {
      const attemptedStation = stations.find(s => s.id === stationTflId);
      const expectedStation = stations.find(s => s.id === nextExpected);
      const sequence = activity.station_tfl_ids.indexOf(nextExpected) + 1;
      console.log(`🚫 Out of sequence: expected #${sequence} ${expectedStation?.name}, attempted ${attemptedStation?.name || stationTflId}`);
      
      return { 
        allowed: false, 
        reason: `Out of sequence. Please check in at #${sequence} ${expectedStation?.name || nextExpected} next.`,
        expectedStation: nextExpected
      };
    }

    return { allowed: true };
  };

  // Check if we can upload (no duplicate stations, activity not complete, no pending verifications)
  const canUploadImage = (): boolean => {
    const isActivityComplete = activity?.status === 'completed';
    const hasPendingUpload = isVerifying || isUploading;
    
    // Check if there's a pending verification
    const pendingVisit = activity?.station_visits?.find((visit: any) => visit.status === 'pending');
    if (pendingVisit) return false;
    
    // Check if all planned stations have been visited
    const nextExpected = getNextExpectedStation();
    const allStationsCompleted = !nextExpected;
    
    return !isActivityComplete && !hasPendingUpload && !allStationsCompleted;
  };

  // 3-Step Validation Pipeline
  const runValidationPipeline = async (imageData: string) => {
    const logEntry: ValidationLogEntry = {
      step: 'ocr',
      simulation_mode_env: simulationModeEnv,
      simulation_mode_user: simulationModeUser,
      simulation_mode_effective: simulationModeEffective,
      result: 'error'
    };

    try {
      // STEP 1: OCR Validation
      logEntry.step = 'ocr';
      console.log('🧭 Checkin: Step 1 - OCR validation, image bytes size=', imageData.length);
      
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('verify-roundel', {
        body: { imageData }
      });

      if (ocrError) throw ocrError;

      // Handle pending/setup scenarios
      if (ocrResult.pending) {
        if (ocrResult.setup_required) {
          throw new Error("AI verification not configured. Photo saved as pending.");
        } else {
          throw new Error(ocrResult.message || "AI verification temporarily unavailable.");
        }
      }

      // Normalize OCR result
      const normalizedOCR: OCRResult = {
        is_roundel: ocrResult.is_roundel || ocrResult.success || false,
        station_text_raw: ocrResult.station_text_raw || ocrResult.text_seen || '',
        station_name: ocrResult.station_name,
        confidence: ocrResult.confidence || 0
      };

      logEntry.station_text_raw = normalizedOCR.station_text_raw;

      // Validate roundel detection
      if (!normalizedOCR.is_roundel) {
        logEntry.error_code = 'no_roundel';
        logEntry.error_message = 'Roundel not detected. Try again with the roundel centered and in focus.';
        throw new Error(logEntry.error_message);
      }

      logEntry.result = 'success';
      console.log('🧭 Checkin: Step 1 SUCCESS -', logEntry);

      // STEP 2: Station Resolution
      logEntry.step = 'resolve';
      logEntry.result = 'error';
      
      console.log('🧭 Checkin: Step 2 - Station resolution:', {
        stationTextRaw: normalizedOCR.station_text_raw,
        stationName: normalizedOCR.station_name
      });

      const resolverResult = resolveStation(
        normalizedOCR.station_text_raw,
        normalizedOCR.station_name,
        stations,
        location ? { lat: location.lat, lng: location.lng } : undefined
      );

      if ('error' in resolverResult) {
        logEntry.error_code = 'station_not_found';
        logEntry.error_message = `Station not found: ${normalizedOCR.station_text_raw}. (We looked for '${normalizedOCR.station_text_raw.toLowerCase().trim()}' and common variants.)`;
        
        // Show suggestions if available
        if (resolverResult.suggestions && resolverResult.suggestions.length > 0) {
          const suggestionNames = resolverResult.suggestions.slice(0, 3).map(s => s.name).join(', ');
          logEntry.error_message += ` Did you mean: ${suggestionNames}?`;
          setSuggestions(resolverResult.suggestions.slice(0, 3).map(s => ({ tfl_id: s.id, name: s.name })));
        }
        
        throw new Error(logEntry.error_message);
      }

      const resolvedStation = resolverResult as ResolvedStation;
      logEntry.resolved_display_name = resolvedStation.display_name;
      logEntry.station_id = resolvedStation.station_id;
      
      // Log successful station resolution
      console.log(`🎯 Resolved ${resolvedStation.display_name} -> ${resolvedStation.station_id} (rule=${resolvedStation.matching_rule})`);
      
      // Check if station check-in is allowed (sequential enforcement)
      const checkinAllowed = isStationCheckinAllowed(resolvedStation.station_id);
      if (!checkinAllowed.allowed) {
        logEntry.error_code = checkinAllowed.expectedStation ? 'out_of_sequence' : 'already_checked_in';
        logEntry.error_message = checkinAllowed.reason || `Check-in not allowed at ${resolvedStation.display_name}`;
        console.log(`🚫 Sequential check validation failed: ${logEntry.error_message}`);
        throw new Error(logEntry.error_message);
      }
      
      logEntry.result = 'success';
      console.log('🧭 Checkin: Step 2 SUCCESS -', logEntry);

      // STEP 3: Geofencing (skip if simulation mode)
      logEntry.step = 'geofence';
      logEntry.result = 'error';
      logEntry.geofence_radius_m = GEOFENCE_RADIUS_METERS;
      logEntry.user_lat = location?.lat;
      logEntry.user_lng = location?.lng;
      logEntry.station_lat = resolvedStation.coords.lat;
      logEntry.station_lng = resolvedStation.coords.lon;

      if (simulationModeEffective) {
        console.log('🧭 Checkin: Step 3 - Geofencing SKIPPED (simulation mode)');
        logEntry.result = 'bypassed';
        logEntry.geofence_bypassed = true;
        logEntry.error_message = 'Bypassed in simulation mode';
      } else {
        console.log('🧭 Checkin: Step 3 - Geofencing validation');
        
        if (!location) {
          logEntry.error_code = 'gps_unavailable';
          logEntry.error_message = 'Location unavailable — we can\'t verify proximity. You can save this check-in as Pending.';
          
          // Set geofence error for UI handling
          setGeofenceError({
            message: logEntry.error_message,
            code: logEntry.error_code,
            resolvedStation,
            ocrResult: normalizedOCR
          });
          
          throw new Error(logEntry.error_message);
        }

        // Calculate distance to resolved station
        const distance = calculateDistance(
          location.lat,
          location.lng,
          resolvedStation.coords.lat,
          resolvedStation.coords.lon
        );

        logEntry.distance_m = Math.round(distance);
        logEntry.geofence_passed = distance <= GEOFENCE_RADIUS_METERS;

        if (distance > GEOFENCE_RADIUS_METERS) {
          logEntry.error_code = 'out_of_range';
          logEntry.error_message = `Outside geofence: you're ${Math.round(distance)}m from ${resolvedStation.display_name} (limit ${GEOFENCE_RADIUS_METERS}m). Enable Simulation Mode for testing or try again near the station.`;
          
          // Set geofence error for UI handling
          setGeofenceError({
            message: logEntry.error_message,
            code: logEntry.error_code,
            resolvedStation,
            distance: Math.round(distance),
            ocrResult: normalizedOCR
          });
          
          throw new Error(logEntry.error_message);
        }

        logEntry.result = 'success';
        console.log('🧭 Checkin: Step 3 SUCCESS -', logEntry);
      }

      // STEP 4: Upload Image and Persist Visit
      logEntry.step = 'persist';
      logEntry.result = 'error';

      console.log('🧭 Checkin: Step 4 - Upload image and persist visit');
      
      // Upload image to storage
      const fileName = `${user?.id}/${activityId}/${Date.now()}-roundel.jpg`;
      const imageUrl = await uploadImage(imageData, fileName);
      
      if (!imageUrl) {
        logEntry.error_code = 'image_upload_failed';
        logEntry.error_message = 'Failed to upload verification image';
        throw new Error(logEntry.error_message);
      }
      
      await checkinMutation.mutateAsync({
        stationTflId: resolvedStation.station_id,
        checkinType: 'image',
        imageData: imageUrl, // Now using the uploaded URL instead of base64
        verificationResult: {
          success: true,
          pending: false,
          station_name: resolvedStation.display_name,
          confidence: normalizedOCR.confidence,
          distance_m: logEntry.distance_m || 0,
          verification_method: 'roundel_ai',
          ai_station_text: normalizedOCR.station_text_raw,
          ai_confidence: normalizedOCR.confidence,
          matching_rule: resolvedStation.matching_rule,
          simulation_mode_env: simulationModeEnv,
          simulation_mode_user: simulationModeUser,
          simulation_mode_effective: simulationModeEffective,
          geofence_distance_m: logEntry.distance_m || 0,
          geofence_radius_m: GEOFENCE_RADIUS_METERS,
          geofence_passed: logEntry.geofence_passed || false,
          geofence_bypassed: logEntry.geofence_bypassed || false
        },
        imageUrl
      });

      logEntry.result = 'success';
      console.log('🧭 Checkin: Step 4 SUCCESS -', logEntry);

      // Show confirmation instead of toast
      const sequenceNumber = (activity?.station_visits?.length || 0) + 1;
      setLastConfirmation({
        stationName: resolvedStation.display_name,
        timestamp: new Date(),
        sequenceNumber,
        imageUrl
      });
      setShowConfirmation(true);

      setVerificationError(null);
      setSuggestions(null);
      setGeofenceError(null);

    } catch (error: any) {
      console.error('🧭 Checkin: Pipeline failed at step', logEntry.step, '-', logEntry);
      
      // Set appropriate error message and suggestions
      setVerificationError(logEntry.error_message || error.message);
      
      // Show specific error toast
      toast({
        title: logEntry.step === 'ocr' ? "Roundel not detected" : 
               logEntry.step === 'resolve' ? "Station not found" :
               logEntry.step === 'geofence' ? "Location check failed" : "Check-in failed",
        description: logEntry.error_message || error.message,
        variant: "destructive"
      });
    }
  };

  // AI Roundel verification mutation
  const verifyRoundelMutation = useMutation({
    mutationFn: async ({ imageData }: { imageData: string }) => {
      await runValidationPipeline(imageData);
    },
    onSuccess: () => {
      setIsVerifying(false);
      setCapturedImage(null);
      setIsCamera(false);
    },
    onError: () => {
      setIsVerifying(false);
    }
  });

  // Checkin mutation
  const checkinMutation = useMutation({
    mutationFn: async ({ 
      stationTflId, 
      checkinType, 
      imageData,
      verificationResult,
      imageUrl
    }: { 
      stationTflId: string; 
      checkinType: 'gps' | 'image' | 'manual';
      imageData?: string;
      verificationResult?: any;
      imageUrl?: string;
    }) => {
      if (!user || !activity) throw new Error("Missing data");

      const sequenceNumber = (activity.station_visits?.length || 0) + 1;
      
      // Determine status and verification method based on CHECK constraints
      // status must be 'pending' or 'visited' per station_visits_status_check
      // verification_method must be 'gps', 'roundel_ai', or 'manual' per station_visits_verification_method_check
      let status = 'visited';
      let verificationMethod = 'gps';
      
      if (checkinType === 'image') {
        verificationMethod = 'roundel_ai';
        status = verificationResult?.success ? 'visited' : 'pending';
      } else if (checkinType === 'manual') {
        verificationMethod = 'manual';
      }
      
      const visitData = {
        user_id: user.id,
        activity_id: activity.id,
        station_tfl_id: stationTflId,
        sequence_number: sequenceNumber,
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        checkin_type: checkinType,
        verification_image_url: imageUrl || imageData || null,
        status,
        verification_method: verificationMethod,
        ai_verification_result: verificationResult || null,
        ai_station_text: verificationResult?.ai_station_text || null,
        ai_confidence: verificationResult?.confidence || null,
        visit_lat: location?.lat || null,
        visit_lon: location?.lng || null,
        visited_at: new Date().toISOString(),
      };

      console.log('🧭 Checkin: insert payload =', visitData);
      console.log('🧭 Checkin: status=', visitData.status, 'verification_method=', visitData.verification_method);

      const { data, error } = await supabase
        .from("station_visits")
        .insert(visitData)
        .select()
        .single();

      if (error) {
        console.error('🧭 Checkin: insert error =', error);
        
        // Provide helpful error message for constraint violations
        if (error.code === '23514') {
          if (error.message?.includes('status_check')) {
            throw new Error('Save failed: invalid status value. Please try again or contact support.');
          } else if (error.message?.includes('verification_method')) {
            throw new Error('Save failed: invalid verification method. Please try again or contact support.');
          }
        }
        
        throw error;
      }

      // If activity is in draft status, activate it on first check-in
      if (activity.status === 'draft') {
        // First pause any other active activities
        const { error: pauseError } = await supabase
          .from('activities')
          .update({ status: 'paused' })
          .eq('user_id', user.id)
          .eq('status', 'active');
        
        if (pauseError) console.warn('Error pausing other activities:', pauseError);

        // Then activate this activity
        const { error: updateError } = await supabase
          .from('activities')
          .update({ status: 'active' })
          .eq('id', activity.id);
        
        if (updateError) throw updateError;
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate all related queries to ensure UI consistency
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      queryClient.invalidateQueries({ queryKey: ["activity_visits", activityId] });
      
      console.log(`VisitCommit ok: activity=${activityId} station=${variables.stationTflId} seq=#{${data.sequence_number}} plan_status=${data.status} visits_row_id=${data.id}`);
      
      // Only show toast for GPS checkins since image checkins handle their own success toasts
      if (variables.checkinType === 'gps') {
        toast({
          title: "✅ Station checked in",
          description: "Your GPS visit has been recorded.",
        });
      } else if (variables.checkinType === 'image' && !variables.verificationResult?.success) {
        // Only show pending toast for failed image verifications
        toast({
          title: "📋 Pending verification", 
          description: "Photo saved for review. You can proceed.",
          className: "border-yellow-200 bg-yellow-50",
        });
      }
      
      setCapturedImage(null);
      setIsCamera(false);
      setVerificationError(null);
      setSuggestions(null);
      setGeofenceError(null);
    },
    onError: (error: any) => {
      console.error('🧭 Checkin: mutation error =', error);
      
      let errorMessage = "Please try again.";
      if (error?.message?.includes('verification_method')) {
        errorMessage = "Check-in failed: invalid value for verification_method.";
      }
      
      toast({
        title: "Check-in failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCamera(true);
      }
    } catch (error) {
      toast({
        title: "Camera access denied",
        description: "Image checkin will not be available.",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context?.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      
      // Stop camera
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setIsCamera(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
      };
      reader.readAsDataURL(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
    }
  };

  const handleGpsCheckin = (stationTflId: string) => {
    checkinMutation.mutate({
      stationTflId,
      checkinType: 'gps',
    });
  };

  const handleImageCheckin = () => {
    if (capturedImage) {
      // Check if this is the final station and disable if activity complete
      const totalVisits = activity?.station_visits?.filter((visit: any) => visit.status === 'visited').length || 0;
      const isActivityComplete = activity?.status === 'completed';
      
      if (isActivityComplete) {
        toast({
          title: "Activity completed",
          description: "All stations have been visited. No more check-ins allowed.",
          variant: "destructive"
        });
        return;
      }
      
      setIsVerifying(true);
      setVerificationError(null);
      setSuggestions(null);
      verifyRoundelMutation.mutate({ imageData: capturedImage });
    }
  };

  const handleSuggestionSelect = (suggestionTflId: string) => {
    if (capturedImage) {
      checkinMutation.mutate({
        stationTflId: suggestionTflId,
        checkinType: 'image',
        imageData: capturedImage,
        verificationResult: { success: true, user_selected: true }
      });
    }
  };

  const handleSaveAsPending = () => {
    if (capturedImage && geofenceError?.resolvedStation && geofenceError?.ocrResult) {
      checkinMutation.mutate({
        stationTflId: geofenceError.resolvedStation.station_id,
        checkinType: 'image',
        imageData: capturedImage,
        verificationResult: {
          success: false,
          pending: true,
          station_name: geofenceError.resolvedStation.display_name,
          confidence: geofenceError.ocrResult.confidence,
          verification_method: 'roundel_ai',
          ai_station_text: geofenceError.ocrResult.station_text_raw,
          ai_confidence: geofenceError.ocrResult.confidence,
          geofence_failed: true,
          geofence_distance_m: geofenceError.distance || 0,
          geofence_radius_m: GEOFENCE_RADIUS_METERS,
          verification_note: `Geofence failed: ${geofenceError.code}`
        }
      });
    }
  };

  const handleCancelGeofence = () => {
    setGeofenceError(null);
    setCapturedImage(null);
    setVerificationError(null);
    setSuggestions(null);
  };

  if (loading || activityLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !activity) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-lg">Activity not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header with Back Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/activities/${activityId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Activity
          </Button>
          {simulationModeEffective && (
            <Badge variant="outline" className="border-yellow-400 text-yellow-700 bg-yellow-50">
              ⚡ SIMULATION
            </Badge>
          )}
        </div>

        {/* Simulation Banner - Dismissible */}
        <SimulationBanner 
          visible={simulationModeEffective} 
          className="mb-4"
        />

        {/* Check-in Confirmation */}
        {lastConfirmation && (
          <CheckinConfirmation
            stationName={lastConfirmation.stationName}
            timestamp={lastConfirmation.timestamp}
            isSimulation={simulationModeEffective}
            sequenceNumber={lastConfirmation.sequenceNumber}
            imageUrl={lastConfirmation.imageUrl}
            onDismiss={() => setShowConfirmation(false)}
            visible={showConfirmation}
          />
        )}

        {/* Activity Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Station Check-in</CardTitle>
                <CardDescription>
                  {activity.route?.name || `Activity ${activity.id.slice(0, 8)}`}
                </CardDescription>
              </div>
              <Badge variant="outline" className="capitalize">
                {activity.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Stations: {activity.station_visits?.filter((v: any) => v.status === 'visited').length || 0} visited</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{new Date(activity.started_at).toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Visits */}
        {activity.station_visits && activity.station_visits.length > 0 && (
          <RecentVisitsList 
            visits={activity.station_visits}
            stations={stations}
            isSimulation={simulationModeEffective}
          />
        )}

        {/* Camera/Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Check-in Options
              {!canUploadImage() && (
                <Badge variant="outline" className="text-xs">
                  {activity?.status === 'completed' ? 'COMPLETED' : 'UPLOADING...'}
                </Badge>
              )}
            </CardTitle>
             <p className="text-sm text-muted-foreground">
               {(() => {
                 if (!canUploadImage()) {
                   const pendingVisit = activity?.station_visits?.find((visit: any) => visit.status === 'pending');
                   if (pendingVisit) {
                     const pendingStation = stations.find(s => s.id === pendingVisit.station_tfl_id);
                     const pendingMessage = `Finish or cancel the current verification at ${pendingStation?.name || 'previous station'} before checking into another station.`;
                     console.log('HUD next expected: pending verification blocks new checkins');
                     return pendingMessage;
                   }
                   
                   if (activity?.status === 'completed') {
                     console.log('HUD next expected: activity completed');
                     return "Activity completed - all stations visited";
                   }
                   
                   const nextExpected = getNextExpectedStation();
                   if (!nextExpected) {
                     console.log('HUD next expected: all planned stations completed');
                     return "All planned stations completed! You can finish the activity.";
                   }
                   
                   console.log('HUD next expected: processing checkin');
                   return "Processing your check-in...";
                 }
                 
                 const nextExpected = getNextExpectedStation();
                 const nextStation = nextExpected ? stations.find(s => s.id === nextExpected) : null;
                 const sequence = nextExpected && activity?.station_tfl_ids ? 
                   activity.station_tfl_ids.indexOf(nextExpected) + 1 : null;
                 
                 console.log(`HUD next expected: ${sequence ? `#${sequence} ${nextStation?.name || nextExpected}` : 'none'} | status=ready`);
                 return "Take a photo of the station roundel or upload an image. You must visit stations in sequence.";
               })()}
             </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {canUploadImage() && !capturedImage && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={startCamera}
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  variant="outline"
                  disabled={!canUploadImage()}
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-sm">Take Photo</span>
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  variant="outline"
                  disabled={!canUploadImage()}
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                  <span className="text-sm">Upload Image</span>
                </Button>
              </div>
            )}

            {!canUploadImage() && (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  {(() => {
                    const pendingVisit = activity?.station_visits?.find((visit: any) => visit.status === 'pending');
                    if (pendingVisit) {
                      const pendingStation = stations.find(s => s.id === pendingVisit.station_tfl_id);
                      return `⏳ Verification pending at ${pendingStation?.name || 'previous station'}`;
                    }
                    
                    if (activity?.status === 'completed') {
                      return "🎉 Activity completed! All stations have been visited.";
                    }
                    
                    const nextExpected = getNextExpectedStation();
                    if (!nextExpected) {
                      return "🎉 All planned stations completed! You can finish the activity.";
                    }
                    
                    return "⏳ Processing your check-in...";
                  })()}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {isCamera && (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg border aspect-video object-cover"
                />
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    Capture
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const stream = videoRef.current?.srcObject as MediaStream;
                      stream?.getTracks().forEach(track => track.stop());
                      setIsCamera(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-4">
                <img
                  src={capturedImage}
                  alt="Captured roundel"
                  className="w-full rounded-lg border"
                />

                {isVerifying && (
                  <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>Analyzing photo...</span>
                  </div>
                )}

                {verificationError && !geofenceError && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-destructive font-medium">Verification Failed</p>
                        <p className="text-sm text-destructive/80 mt-1">{verificationError}</p>
                        
                        {suggestions && suggestions.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Did you mean one of these?</p>
                            <div className="space-y-1">
                              {suggestions.map((suggestion) => (
                                <Button
                                  key={suggestion.tfl_id}
                                  variant="outline"
                                  size="sm"
                                  className="mr-2 mb-1"
                                  onClick={() => handleSuggestionSelect(suggestion.tfl_id)}
                                  disabled={checkinMutation.isPending}
                                >
                                  {suggestion.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {geofenceError && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-yellow-800 font-medium">
                          {geofenceError.code === 'gps_unavailable' ? 'Location Unavailable' : 'Outside Geofence'}
                        </p>
                        <p className="text-sm text-yellow-700 mt-1">{geofenceError.message}</p>
                        
                        {geofenceError.code === 'out_of_range' && geofenceError.resolvedStation && (
                          <div className="mt-2 text-sm text-yellow-700">
                            <p><strong>Station:</strong> {geofenceError.resolvedStation.display_name}</p>
                            <p><strong>Distance:</strong> {geofenceError.distance}m (limit {GEOFENCE_RADIUS_METERS}m)</p>
                          </div>
                        )}

                        <div className="mt-4 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveAsPending}
                            disabled={checkinMutation.isPending}
                            className="bg-white hover:bg-yellow-50"
                          >
                            Save as Pending
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelGeofence}
                            disabled={checkinMutation.isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCapturedImage(null);
                      setVerificationError(null);
                      setSuggestions(null);
                      setGeofenceError(null);
                    }}
                    className="flex-1"
                    disabled={isVerifying}
                  >
                    Retake
                  </Button>
                  {!verificationError && !geofenceError && (
                    <Button
                      onClick={handleImageCheckin}
                      disabled={isVerifying || isUploading || !canUploadImage()}
                      className="flex-1"
                    >
                      {isVerifying || isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isUploading ? "Uploading..." : "Verifying..."}
                        </>
                      ) : (
                        "Verify & Check In"
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Success Actions - Show after successful check-in */}
                {lastConfirmation && showConfirmation && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-green-800">
                        ✅ Check-in successful! What's next?
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCapturedImage(null);
                          setShowConfirmation(false);
                          setLastConfirmation(null);
                        }}
                        className="flex-1 bg-white hover:bg-green-50"
                      >
                        Continue Check-in
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/activities/${activityId}`)}
                        className="flex-1"
                      >
                        Back to Activity
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>

        {/* Dev Panel - Always visible when simulation mode is available */}
        {SIMULATION_MODE_ENV && (
          <DevPanel />
        )}

        {/* Nearby Stations */}
        {nearbyStations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nearby Stations</CardTitle>
              <CardDescription>GPS-based check-ins available</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {nearbyStations.slice(0, 3).map((station: any) => {
                  const isVisited = activity.station_visits?.some(
                    (visit: any) => visit.station_tfl_id === station.tfl_id && visit.status === 'visited'
                  );
                  
                  return (
                    <div
                      key={station.tfl_id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{station.name}</h3>
                          {isVisited && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Zone {station.zone} · {Math.round(station.distance * 1000)}m away
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGpsCheckin(station.tfl_id)}
                        disabled={(() => {
                          const checkinCheck = isStationCheckinAllowed(station.tfl_id);
                          return checkinMutation.isPending || !checkinCheck.allowed;
                        })()}
                        className="text-xs"
                      >
                        <MapPin className="w-3 h-3 mr-1" />
                        GPS
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ActivityCheckin;