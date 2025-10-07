import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, MapPin, Clock, CheckCircle, ArrowLeft, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { useStations } from "@/hooks/useStations";
import { resolveStation, ResolvedStation } from "@/lib/stationResolver";
import { DevPanel, useSimulationMode } from "@/components/DevPanel";
import { SimulationBanner } from "@/components/SimulationBanner";
import { useImageUpload } from "@/hooks/useImageUpload";
import { calculateDistance, extractImageGPS, extractImageTimestamp } from "@/lib/utils";
import { getGeofenceRadiusMeters, validateGeofence } from "@/config/geofence";


// Configuration
const envGeofenceRadius = Number(import.meta.env.VITE_GEOFENCE_RADIUS_METERS);
const GEOFENCE_RADIUS_METERS = Number.isFinite(envGeofenceRadius) && envGeofenceRadius > 0
  ? envGeofenceRadius
  : 750;
const VERIFIER_VERSION = "free-order-v1";
const SIMULATION_MODE_ENV = import.meta.env.DEV || import.meta.env.VITE_SIMULATION_MODE === 'true';

// Interface for derived activity state (free-order mode)
interface DerivedActivityState {
  activity_id: string;
  version: number;
  plan: Array<{
    sequence: number;
    station_tfl_id: string;
    display_name: string;
    status: 'not_visited' | 'pending' | 'verified';
    visited_at?: string;
    image_url?: string;
  }>;
  actual_visits: Array<{
    sequence: number;
    station_tfl_id: string;
    display_name: string;
    visited_at: string;
    image_url?: string;
  }>;
  counts: {
    planned_total: number;
    visited_actual: number;
    pending: number;
  };
  started_at?: string;
  finished_at?: string;
}

interface OCRResult {
  is_roundel: boolean;
  station_text_raw: string;
  station_name?: string;
  confidence: number;
}

type VisitMetadata = {
  capturedAt: string;
  visitedAt: string;
  exifTimePresent: boolean;
  exifGpsPresent: boolean;
  gpsSource: 'exif' | 'device' | 'none';
  geofenceDistance: number | null;
  latitude: number | null;
  longitude: number | null;
};

// Helper functions

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

  // Enhanced features
  const { uploadImage, isUploading } = useImageUpload();
  const [lastVisitMetadata, setLastVisitMetadata] = useState<VisitMetadata | null>(null);
  

  // Clean up component state on unmount
  useEffect(() => {
    return () => {
      // Cleanup on unmount to prevent memory leaks
      setCapturedImage(null);
      setVerificationError(null);
      setSuggestions(null);
      setGeofenceError(null);
      setPreviewMetadata(null);
      setLastVisitMetadata(null);
    };
  }, []);

  // Defensive error handling for telemetry/analytics
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      try {
        return originalFetch.apply(window, args);
      } catch (error: any) {
        // Suppress DataCloneError from postMessage analytics
        if (error.name === 'DataCloneError' && error.message.includes('postMessage')) {
          console.debug('Suppressed DataCloneError from analytics:', error.message);
          return Promise.reject(error);
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Page entry logging
  useEffect(() => {
    console.log(`🧭 ActivityCheckin: Free-order mode | id=${activityId} user=${user?.id || 'none'}`);
    console.log('🧭 Config:', { 
      geofenceRadius: getGeofenceRadiusMeters(), 
      simulationModeEnv,
      simulationModeUser,
      simulationModeEffective
    });
  }, [activityId, user?.id, simulationModeEnv, simulationModeUser, simulationModeEffective]);

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
          description: "GPS check-in will not be available.",
          variant: "destructive",
        });
        }
      );
    }
  }, [toast]);

  // Fetch activity with derived state
  const { data: activityState, refetch: refetchActivityState } = useQuery({
    queryKey: ["activity_state", activityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('derive_activity_state', { 
        activity_id_param: activityId 
      });
      if (error) {
        console.log(`DerivedState error: ${error.message}`);
        throw error;
      }
      
      const derivedState = data as unknown as DerivedActivityState;
      const visitedCount = derivedState.counts.visited_actual || 0;
      console.log(`DerivedState: planned=${derivedState.counts.planned_total} visited=${visitedCount} actual_visits=${derivedState.actual_visits?.length || 0}`);
      return derivedState;
    },
    enabled: !!user && !!activityId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Fetch basic activity details
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(`*`)
        .eq("id", activityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!activityId,
  });

  // Check if a station check-in is allowed (free-order mode)
  const isStationCheckinAllowed = (stationTflId: string): { allowed: boolean; reason?: string } => {
    if (!activityState) return { allowed: false, reason: 'Activity state not loaded' };
    
    // Check if there's already a pending verification
    const pendingStation = activityState.plan.find(station => station.status === 'pending');
    if (pendingStation) {
      return { 
        allowed: false, 
        reason: `Finish or cancel the current verification at ${pendingStation.display_name} before checking into another station.`
      };
    }
    
    // Check if station is already successfully checked in (duplicate prevention)
    const alreadyCheckedIn = activityState.actual_visits?.some(visit => visit.station_tfl_id === stationTflId);
    if (alreadyCheckedIn) {
      const stationName = stations.find(s => s.id === stationTflId)?.name || stationTflId;
      return { 
        allowed: false,
        reason: `Already checked in to ${stationName} for this activity.`
      };
    }

    // Free-order mode: allow any station that exists in the stations database
    const stationExists = stations.some(s => s.id === stationTflId);
    if (!stationExists) {
      return {
        allowed: false,
        reason: 'Station not found in database.'
      };
    }

    return { allowed: true };
  };

  // Check if we can upload (free-order mode)
  const canUploadImage = (): boolean => {
    const isActivityComplete = activity?.status === 'completed';
    const hasPendingUpload = isVerifying || isUploading;
    
    // Check if there's a pending verification
    const pendingStation = activityState?.plan.find(station => station.status === 'pending');
    if (pendingStation) return false;
    
    return !isActivityComplete && !hasPendingUpload;
  };

  // 4-Step Validation Pipeline for Free-Order Check-ins
  const runValidationPipeline = async (imageData: string) => {
    try {
      setIsVerifying(true);

      const visitTimestamp = new Date();
      let capturedAtDate: Date = visitTimestamp;
      let exifTimePresent = false;
      let exifGpsPresent = false;
      let geofenceDistance: number | null = null;
      let gpsSource: 'exif' | 'device' | 'none' = 'none';
      let resolvedLatitude: number | null = null;
      let resolvedLongitude: number | null = null;
      const commitMetadataSnapshot = () => {
        const metadata: VisitMetadata = {
          capturedAt: capturedAtDate.toISOString(),
          visitedAt: visitTimestamp.toISOString(),
          exifTimePresent,
          exifGpsPresent,
          gpsSource,
          geofenceDistance,
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
        };
        setLastVisitMetadata(metadata);
        return metadata;
      };

      
      // STEP 0: EXIF Extraction (parallel processing)
      console.log('🧭 Free-Order Checkin: Step 0 - EXIF extraction');
      
      const [imageGPS, capturedTimestamp] = await Promise.all([
        extractImageGPS(imageData),
        extractImageTimestamp(imageData)
      ]);
      
      console.log('🧭 EXIF Results:', {
        hasGPS: !!imageGPS,
        hasTimestamp: !!capturedTimestamp,
        gps: imageGPS,
        timestamp: capturedTimestamp
      });
      
      // STEP 1: OCR Validation
      console.log('🧭 Free-Order Checkin: Step 1 - OCR validation');
      
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('verify-roundel', {
        body: { imageData }
      });

      if (ocrError) throw ocrError;

      if (ocrResult.pending) {
        throw new Error(ocrResult.message || "AI verification temporarily unavailable.");
      }

      // Normalize OCR result
      const normalizedOCR: OCRResult = {
        is_roundel: ocrResult.is_roundel || ocrResult.success || false,
        station_text_raw: ocrResult.station_text_raw || ocrResult.text_seen || '',
        station_name: ocrResult.station_name,
        confidence: ocrResult.confidence || 0
      };

      // Validate roundel detection
      if (!normalizedOCR.is_roundel) {
        throw new Error('Roundel not detected. Try again with the roundel centered and in focus.');
      }

      console.log('🧭 Free-Order Checkin: Step 1 SUCCESS');

      // STEP 2: Station Resolution
      console.log('🧭 Free-Order Checkin: Step 2 - Station resolution');

      const resolverResult = resolveStation(
        normalizedOCR.station_text_raw,
        normalizedOCR.station_name,
        stations,
        location ? { lat: location.lat, lng: location.lng } : undefined
      );

      if ('error' in resolverResult) {
        let errorMessage = `Station not found: ${normalizedOCR.station_text_raw}`;
        
        // Show suggestions if available
        if (resolverResult.suggestions && resolverResult.suggestions.length > 0) {
          const suggestionNames = resolverResult.suggestions.slice(0, 3).map(s => s.name).join(', ');
          errorMessage += ` Did you mean: ${suggestionNames}?`;
          setSuggestions(resolverResult.suggestions.slice(0, 3).map(s => ({ tfl_id: s.id, name: s.name })));
        }
        
        throw new Error(errorMessage);
      }

      const resolvedStation = resolverResult as ResolvedStation;
      console.log(`🎯 Resolved ${resolvedStation.display_name} -> ${resolvedStation.station_id}`);

      // Check if station check-in is allowed (free-order mode)
      const checkinAllowed = isStationCheckinAllowed(resolvedStation.station_id);
      if (!checkinAllowed.allowed) {
        console.log(`🚫 Check-in validation failed: ${checkinAllowed.reason}`);
        throw new Error(checkinAllowed.reason || `Check-in not allowed at ${resolvedStation.display_name}`);
      }
      
      console.log('🧭 Free-Order Checkin: Step 2 SUCCESS');

      // STEP 3: Geofencing using EXIF GPS from image (skip if simulation mode)
      console.log('🧭 Free-Order Checkin: Step 3 - EXIF extraction & geofencing');

      const [imageGPS, imageTimestamp] = await Promise.all([
        extractImageGPS(imageData).catch((error) => {
          console.warn('🧭 Free-Order Checkin: EXIF GPS parse failed', error);
          return null;
        }),
        extractImageTimestamp(imageData).catch((error) => {
          console.warn('🧭 Free-Order Checkin: EXIF timestamp parse failed', error);
          return null;
        })
      ]);

      if (imageTimestamp instanceof Date) {
        capturedAtDate = imageTimestamp;
        exifTimePresent = true;
      }

      if (imageGPS) {
        exifGpsPresent = true;
        resolvedLatitude = imageGPS.lat;
        resolvedLongitude = imageGPS.lng;
      }

      if (simulationModeEffective) {
        console.log('🧭 Free-Order Checkin: Step 3 - Geofencing SKIPPED (simulation mode)');
        if (imageGPS) {
          gpsSource = 'exif';
        } else if (location) {
          gpsSource = 'device';
          resolvedLatitude = location.lat;
          resolvedLongitude = location.lng;
        } else {
          gpsSource = 'none';
        }
      } else {
        if (imageGPS) {
          gpsSource = 'exif';
          geofenceDistance = calculateDistance(
            imageGPS.lat,
            imageGPS.lng,
            resolvedStation.coords.lat,
            resolvedStation.coords.lon
          );

          if (geofenceDistance > GEOFENCE_RADIUS_METERS) {
            const errorMessage = `Photo location is ${Math.round(geofenceDistance)}m from ${resolvedStation.display_name} (limit ${GEOFENCE_RADIUS_METERS}m). Take photo closer to the station.`;

            commitMetadataSnapshot();
        console.log('🧭 Free-Order Checkin: Step 3 - EXIF GPS geofencing validation');
        
        // Use pre-extracted GPS data from Step 0
        if (!imageGPS) {
          console.log('🧭 Free-Order Checkin: No EXIF GPS found in image - using device GPS as fallback');
          
          if (!location) {
            const errorMessage = "You're offline. Your check-in is saved as pending and will sync automatically.";
            
            setGeofenceError({
              message: errorMessage,
              code: 'photo_too_far',
              resolvedStation,
              distance: Math.round(geofenceDistance),
              ocrResult: normalizedOCR
            });

            throw new Error(errorMessage);
          }
        } else {
          console.log('🧭 Free-Order Checkin: No EXIF GPS found in image - using device GPS as fallback');

          if (!location) {
            gpsSource = 'none';
            const errorMessage = 'Location unavailable — no GPS in photo and device location denied. You can save this check-in as Pending.';

            commitMetadataSnapshot();
          if (distance > getGeofenceRadiusMeters()) {
            const errorMessage = `We couldn't confirm you're near ${resolvedStation.display_name}. Save as pending or retake a photo near the station.`;
            
            setGeofenceError({
              message: errorMessage,
              code: 'gps_unavailable',
              resolvedStation,
              ocrResult: normalizedOCR
            });

            throw new Error(errorMessage);
          }

          gpsSource = 'device';
          resolvedLatitude = location.lat;
          resolvedLongitude = location.lng;

          geofenceDistance = calculateDistance(
            location.lat,
            location.lng,
            resolvedStation.coords.lat,
            resolvedStation.coords.lon
          );

          if (geofenceDistance > GEOFENCE_RADIUS_METERS) {
            const errorMessage = `Outside geofence: you're ${Math.round(geofenceDistance)}m from ${resolvedStation.display_name} (limit ${GEOFENCE_RADIUS_METERS}m). Take photo closer to the station.`;

            commitMetadataSnapshot();
          if (distance > getGeofenceRadiusMeters()) {
            const errorMessage = `We couldn't confirm you're near ${resolvedStation.display_name}. Save as pending or retake a photo near the station.`;
            
            setGeofenceError({
              message: errorMessage,
              code: 'out_of_range',
              resolvedStation,
              distance: Math.round(geofenceDistance),
              ocrResult: normalizedOCR
            });

            throw new Error(errorMessage);
          }
        }

        console.log('🧭 Free-Order Checkin: Step 3 SUCCESS');
      }

      // STEP 4: Upload Image and Persist Visit
      console.log('🧭 Free-Order Checkin: Step 4 - Upload image and persist visit');
      
      // Upload image to storage (both full image and thumbnail)
      const fileName = `${user?.id}/${activityId}/${Date.now()}-roundel.jpg`;
      const uploadResult = await uploadImage(imageData, fileName);
      
      if (!imageUrl) {
        commitMetadataSnapshot();
      if (!uploadResult) {
        throw new Error('Failed to upload verification image');
      }

      const metadata = commitMetadataSnapshot();

      await checkinMutation.mutateAsync({
        stationTflId: resolvedStation.station_id,
        checkinType: 'image',
        imageUrl: uploadResult.imageUrl,
        thumbUrl: uploadResult.thumbUrl,
        imageGPS,
        capturedTimestamp,
        resolvedStation, // Pass station coordinates for geofence calculation
        verificationResult: {
          success: true,
          pending: false,
          station_name: resolvedStation.display_name,
          confidence: normalizedOCR.confidence,
          verification_method: 'ai_image',
          ai_station_text: normalizedOCR.station_text_raw,
          ai_confidence: normalizedOCR.confidence,
        },
        capturedAt: metadata.capturedAt,
        visitedAt: metadata.visitedAt,
        exifTimePresent: metadata.exifTimePresent,
        exifGpsPresent: metadata.exifGpsPresent,
        gpsSource: metadata.gpsSource,
        geofenceDistance: metadata.geofenceDistance,
        latitude: metadata.latitude,
        longitude: metadata.longitude
      });

      console.log('🧭 Free-Order Checkin: Step 4 SUCCESS');

      // Show success toast with actions
      const sequenceNumber = (activityState?.actual_visits?.length || 0) + 1;
      
      toast({
        title: "✅ Check-in successful",
        description: `Checked in at ${resolvedStation.display_name} (#${sequenceNumber})`,
        variant: "default",
        duration: 5000, // Keep toast visible longer for user actions
        action: (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/activities/${activityId}`)}
            >
              Done
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                // Clear state for next check-in
                setCapturedImage(null);
                setVerificationError(null);
                setSuggestions(null);
                setGeofenceError(null);
                setPreviewMetadata(null);
                setLastVisitMetadata(null);
              }}
            >
              Check Another
            </Button>
          </div>
        )
      });

      // Clear state and prepare for potential next check-in
      setCapturedImage(null);
      setVerificationError(null);
      setSuggestions(null);
      setGeofenceError(null);
      
      // Auto-navigate after successful check-in with minimal delay
      setTimeout(() => {
        console.log('🧭 Navigating back to activity detail...');
        navigate(`/activities/${activityId}`);
         }, 250); // Fast modal dismissal for better UX

    } catch (error: any) {
      console.error('🧭 Free-Order Checkin: Pipeline failed -', error.message);
      
      setVerificationError(error.message);
      
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Checkin mutation
  type CheckinMutationArgs = {
    stationTflId: string;
    checkinType: 'gps' | 'image' | 'manual';
    imageUrl?: string;
    verificationResult?: any;
  } & VisitMetadata;

  const checkinMutation = useMutation({
    mutationFn: async ({
      stationTflId,
      checkinType,
      imageUrl,
      verificationResult,
      capturedAt,
      visitedAt,
      exifTimePresent,
      exifGpsPresent,
      gpsSource,
      geofenceDistance,
      latitude,
      longitude
    }: CheckinMutationArgs) => {
      if (!user || !activity) throw new Error("Missing data");

      const seqActual = (activityState?.actual_visits?.length || 0) + 1;

      const visitData: Database['public']['Tables']['station_visits']['Insert'] = {
        user_id: user.id,
        activity_id: activity.id,
        station_tfl_id: stationTflId,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        checkin_type: checkinType,
        verification_image_url: imageUrl || null,
        status: 'verified', // Free-order mode always creates verified check-ins
        verification_method: 'ai_image',
        ai_verification_result: verificationResult || null,
        ai_station_text: verificationResult?.ai_station_text || null,
        ai_confidence: verificationResult?.confidence || null,
        visit_lat: latitude ?? null,
        visit_lon: longitude ?? null,
        visited_at: visitedAt,
        is_simulation: simulationModeEffective,
        captured_at: capturedAt,
        exif_time_present: exifTimePresent,
        exif_gps_present: exifGpsPresent,
        gps_source: gpsSource,
        geofence_distance_m: geofenceDistance ?? null,
        seq_actual: seqActual,
        pending_reason: null,
        verifier_version: VERIFIER_VERSION,
        thumb_url: null,
      };

      console.log('🧭 Free-Order Checkin: insert payload =', visitData);
      thumbUrl,
      imageGPS,
      capturedTimestamp,
      resolvedStation,
      geofenceResult,
      verificationResult
    }: { 
      stationTflId: string; 
      checkinType: 'gps' | 'image' | 'manual';
      imageUrl?: string;
      thumbUrl?: string;
      imageGPS?: { lat: number; lng: number } | null;
      capturedTimestamp?: Date | null;
      resolvedStation?: ResolvedStation;
      geofenceResult?: any;
      verificationResult?: any;
    }) => {
      if (!user || !activity) throw new Error("Missing data");

      // Use geofence result if available, otherwise determine GPS source and coordinates
      const gpsSource = geofenceResult?.gpsSource || (imageGPS ? 'exif' : (location ? 'device' : 'none'));
      const finalCoords = geofenceResult?.coords || imageGPS || (location ? { lat: location.lat, lng: location.lng } : null);
      const distanceMeters = geofenceResult?.distance || (finalCoords && resolvedStation ? 
        calculateDistance(
          finalCoords.lat, 
          finalCoords.lng, 
          resolvedStation.coords.lat,
          resolvedStation.coords.lon
        ) : null);
      
      // Use the record-visit RPC instead of direct insert
      const recordVisitResult = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: activity.id,
          station_tfl_id: stationTflId,
          user_id: user.id,
          
          // Location data
          latitude: simulationModeEffective ? null : finalCoords?.lat || null,
          longitude: simulationModeEffective ? null : finalCoords?.lng || null,
          visit_lat: simulationModeEffective ? null : finalCoords?.lat || null,
          visit_lon: simulationModeEffective ? null : finalCoords?.lng || null,
          
          // EXIF and image data
          captured_at: capturedTimestamp?.toISOString() || new Date().toISOString(),
          exif_time_present: !!capturedTimestamp,
          exif_gps_present: !!imageGPS,
          gps_source: gpsSource,
          verification_image_url: imageUrl || null,
          verification_thumb_url: thumbUrl || null,
          
          // Geofence data
          geofence_distance_m: Math.round(distanceMeters || 0),
          geofence_result: geofenceResult ? {
            withinGeofence: geofenceResult.withinGeofence,
            distance: geofenceResult.distance,
            gpsSource: geofenceResult.gpsSource
          } : undefined,
          
          // OCR/AI data
          ocr_result: verificationResult?.pending ? undefined : {
            success: !verificationResult?.pending,
            confidence: verificationResult?.confidence || 0,
            station_text_raw: verificationResult?.ai_station_text
          },
          ai_verification_result: verificationResult || null,
          ai_station_text: verificationResult?.ai_station_text || null,
          ai_confidence: verificationResult?.confidence || null,
          
          // Context flags - respect environment variables (A3.6.2)
          simulation_mode: simulationModeEffective,
          ai_enabled: import.meta.env.VITE_AI_VERIFICATION_ENABLED !== 'false',
          has_connectivity: navigator.onLine !== false, // Check actual connectivity
          checkin_type: checkinType,
          verifier_version: '1.0'
        }
      });

      if (recordVisitResult.error) {
        // Check for duplicate visit error
        if (recordVisitResult.error.code === 'duplicate_visit' || recordVisitResult.error.code === 'duplicate_visit_race') {
          const stationName = stations.find(s => s.id === recordVisitResult.error.station_id)?.name || 'this station';
          toast({
            title: "Already checked in",
            description: `Already checked in to ${stationName} for this activity.`,
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(recordVisitResult.error.message || 'Failed to record visit');
      }

      if (!recordVisitResult.data?.success) {
        throw new Error('Failed to record visit - no success response');
      }

      console.log('🎯 Visit recorded via RPC:', {
        visit_id: recordVisitResult.data.visit_id,
        seq_actual: recordVisitResult.data.seq_actual,
        status: recordVisitResult.data.status
      });

      return {
        id: recordVisitResult.data.visit_id,
        station_tfl_id: stationTflId,
        visited_at: new Date().toISOString(),
        status: recordVisitResult.data.status,
        seq_actual: recordVisitResult.data.seq_actual
      };
    },
    onSuccess: async (data, variables) => {
      const sequence = (activityState?.actual_visits?.length || 0) + 1;
      console.log(`✅ VisitCommit success: activity=${activityId} station=${variables.stationTflId} seq=#${sequence} status=verified (free-order)`);
      console.log(`✅ Visit data inserted:`, data);
      
      // Auto-start activity on first successful check-in
      if (activity?.status !== 'active' && (activityState?.actual_visits?.length || 0) === 0) {
        console.log('🚀 Auto-starting activity on first check-in');
        await supabase
          .from('activities')
          .update({ status: 'active', started_at: new Date().toISOString() })
          .eq('id', activity.id);
      }

      // Debug: Check what visits exist in DB after insert
      const { data: dbVisits, error: dbError } = await supabase
        .from('station_visits')
        .select('*')
        .eq('activity_id', activityId)
        .order('visited_at', { ascending: true });
      
      if (dbError) {
        console.error('❌ Error checking DB visits:', dbError);
      } else {
        console.log(`🔍 DB visits after insert (${dbVisits?.length || 0} total):`, dbVisits);
      }

      // Debug: Test derive_activity_state directly
      console.log('🔍 Testing derive_activity_state function...');
      const { data: testState, error: testError } = await supabase.rpc('derive_activity_state', { 
        activity_id_param: activityId 
      });
      if (testError) {
        console.error('❌ derive_activity_state test failed:', testError);
      } else {
        console.log('🔍 derive_activity_state result:', testState);
      }

      // Invalidate queries for immediate UI updates (all required keys)
      console.log('🔄 Starting cache invalidation...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["activity_state", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activity", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activityVisits", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activitySummary", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activityMapData", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activitiesList"] }), // Dashboard counts update
      ]);

      // Force refetch the activity state to ensure immediate update
      await queryClient.refetchQueries({ queryKey: ["activity_state", activityId] });
      
      console.log('✅ Query invalidations and refetch complete');
    },
    onError: (error: any, variables) => {
      console.error("🧭 Free-Order Checkin: mutation failed -", error);
      
      // Detect offline state
      if (!navigator.onLine) {
        return;
      }
      
      // Handle duplicate check-in gracefully
      if (error.message.includes('duplicate key value') || error.message.includes('uniq_visits_user_activity_station')) {
        const resolvedStation = stations.find(s => s.id === variables.stationTflId);
        const stationName = resolvedStation?.name || 'this station';
        
        // Friendly duplicate error with CTA
        setVerificationError(`Already checked in to ${stationName} for this activity.`);
        
        toast({
          title: "Already checked in",
          description: `Already checked in to ${stationName} for this activity.`,
          variant: "destructive",
          duration: 6000, // Keep visible longer for user to see the action
          action: (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/activities/${activityId}`)}
              className="bg-white hover:bg-gray-50"
            >
              View Timeline
            </Button>
          )
        });
      } else {
        toast({
          title: "Check-in failed",
          description: error.message || "An unexpected error occurred",
          variant: "destructive"
        });
      }
    },
  });

  // Camera and upload handlers
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
        description: "Please allow camera access to take photos.",
        variant: "destructive"
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        setIsCamera(false);
        
        // Stop camera stream
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageCheckin = () => {
    if (capturedImage) {
      runValidationPipeline(capturedImage);
    }
  };

  const getFallbackMetadata = (): VisitMetadata => {
    if (lastVisitMetadata) return lastVisitMetadata;

    const nowIso = new Date().toISOString();
    const defaultLat = simulationModeEffective ? null : (location?.lat ?? null);
    const defaultLon = simulationModeEffective ? null : (location?.lng ?? null);

    return {
      capturedAt: nowIso,
      visitedAt: nowIso,
      exifTimePresent: false,
      exifGpsPresent: false,
      gpsSource: defaultLat != null && defaultLon != null ? 'device' : 'none',
      geofenceDistance: null,
      latitude: defaultLat,
      longitude: defaultLon,
    };
  };

  // Helper functions to clear image state and ensure unmounting
  const handleRetakePhoto = () => {
    setCapturedImage(null);
    setVerificationError(null);
    setSuggestions(null);
    setGeofenceError(null);
    setPreviewMetadata(null);
    setLastVisitMetadata(null);

    // Ensure image preview unmounts completely
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSuggestionSelect = (suggestionTflId: string) => {
    if (capturedImage) {
      const metadata = getFallbackMetadata();

      checkinMutation.mutate({
        stationTflId: suggestionTflId,
        checkinType: 'image',
        imageUrl: capturedImage,
        verificationResult: { success: true, user_selected: true },
        capturedAt: metadata.capturedAt,
        visitedAt: metadata.visitedAt,
        exifTimePresent: metadata.exifTimePresent,
        exifGpsPresent: metadata.exifGpsPresent,
        gpsSource: metadata.gpsSource,
        geofenceDistance: metadata.geofenceDistance,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
      });
    }
  };

  const handleSaveAsPending = () => {
    if (capturedImage && geofenceError?.resolvedStation && geofenceError?.ocrResult) {
      const metadata = getFallbackMetadata();

      checkinMutation.mutate({
        stationTflId: geofenceError.resolvedStation.station_id,
        checkinType: 'image',
        imageUrl: capturedImage,
        verificationResult: {
          success: false,
          pending: true,
          station_name: geofenceError.resolvedStation.display_name,
          confidence: geofenceError.ocrResult.confidence,
          verification_method: 'ai_image',
          ai_station_text: geofenceError.ocrResult.station_text_raw,
          ai_confidence: geofenceError.ocrResult.confidence,
          geofence_failed: true,
          geofence_distance_m: geofenceError.distance || 0,
          geofence_radius_m: getGeofenceRadiusMeters(),
          verification_note: `Geofence failed: ${geofenceError.code}`
        },
        capturedAt: metadata.capturedAt,
        visitedAt: metadata.visitedAt,
        exifTimePresent: metadata.exifTimePresent,
        exifGpsPresent: metadata.exifGpsPresent,
        gpsSource: metadata.gpsSource,
        geofenceDistance: metadata.geofenceDistance,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
      });
    }
  };

  const handleCancelGeofence = () => {
    setGeofenceError(null);
    setCapturedImage(null);
    setVerificationError(null);
    setSuggestions(null);
    setPreviewMetadata(null);
    setLastVisitMetadata(null);
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

        {/* Simulation Banner */}
        <SimulationBanner 
          visible={simulationModeEffective} 
          className="mb-4"
        />

        {/* Activity Header - Free Order Mode */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Free-Order Check-in</CardTitle>
                <CardDescription>
                  Check in at any station to continue your activity
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
                <span>Stations: {activityState ? activityState.counts.visited_actual : 0} visited</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {activity.started_at ? 
                    new Date(activity.started_at).toLocaleTimeString() : 
                    'Not started'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Visits */}
        {activityState && activityState.actual_visits && activityState.actual_visits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activityState.actual_visits
                  .slice(-3) // Show last 3 visits
                  .reverse() // Most recent first
                  .map((visit, index) => (
                    <div key={visit.station_tfl_id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{visit.sequence}</Badge>
                        <span className="font-medium">{visit.display_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(visit.visited_at).toLocaleTimeString()}
                        </span>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
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
                  const pendingStation = activityState?.plan.find(station => station.status === 'pending');
                  if (pendingStation) {
                    return `Finish or cancel the current verification at ${pendingStation.display_name} before checking into another station.`;
                  }
                  
                  if (activity?.status === 'completed') {
                    return "Activity completed - all stations visited";
                  }
                  
                  return "Processing your check-in...";
                }
                
                const actualVisits = activityState?.actual_visits?.length || 0;
                if (actualVisits === 0) {
                  return "Check in at any station to continue your activity.";
                } else {
                  return `Checked in at ${actualVisits} station${actualVisits === 1 ? '' : 's'} so far. Check in at any station to continue your activity.`;
                }
              })()}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera Interface */}
            {isCamera && (
              <>
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    Capture
                  </Button>
                  <Button variant="outline" onClick={() => setIsCamera(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {/* Upload Options */}
            {canUploadImage() && !capturedImage && !isCamera && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={startCamera}
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  variant="outline"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-sm">Take Photo</span>
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 flex flex-col items-center justify-center gap-2"
                  variant="outline"
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                  <span className="text-sm">Upload Image</span>
                </Button>
              </div>
            )}

            {/* Captured Image Preview */}
              {capturedImage && (
                <div className="space-y-4">
                  <img
                    src={capturedImage}
                    alt="Captured roundel"
                    className="w-full rounded-lg"
                  />

                  {(lastVisitMetadata ?? previewMetadata) && (() => {
                    const metadataForPreview = lastVisitMetadata ?? previewMetadata;
                    if (!metadataForPreview) return null;
                    const capturedDate = new Date(metadataForPreview.capturedAt);
                    const hasValidDate = !Number.isNaN(capturedDate.getTime());
                    const gpsLabel =
                      metadataForPreview.gpsSource === 'exif'
                        ? 'EXIF GPS'
                        : metadataForPreview.gpsSource === 'device'
                        ? 'Device GPS'
                        : null;

                    if (!hasValidDate && !gpsLabel) {
                      return null;
                    }

                    return (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                        {hasValidDate && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              Captured {capturedDate.toLocaleString()} (
                              {metadataForPreview.exifTimePresent ? 'EXIF time' : 'Device time'}
                              )
                            </span>
                          </div>
                        )}
                        {gpsLabel && (
                          <div className="mt-1 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>
                              {gpsLabel}
                              {metadataForPreview.geofenceDistance != null &&
                                ` · ${Math.round(metadataForPreview.geofenceDistance)}m from station`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                    <div className="flex gap-2">
                      <Button
                        onClick={handleImageCheckin}
                        disabled={isVerifying || checkinMutation.isPending}
                        className="flex-1"
                      >
                        {isVerifying || checkinMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Check In
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleRetakePhoto}>
                        Retake
                      </Button>
                    </div>

                {/* Error Display */}
                {verificationError && (
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="space-y-2">
                        <p className="text-sm text-red-700">{verificationError}</p>
                        
                        {/* Station Suggestions */}
                        {suggestions && suggestions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-red-600">Did you mean one of these?</p>
                            <div className="flex flex-wrap gap-2">
                              {suggestions.map((suggestion) => (
                                <Button
                                  key={suggestion.tfl_id}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSuggestionSelect(suggestion.tfl_id)}
                                  className="text-xs"
                                >
                                  {suggestion.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Geofence Error Actions */}
                        {geofenceError && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleSaveAsPending}
                              disabled={checkinMutation.isPending}
                            >
                              Save as Pending
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelGeofence}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!canUploadImage() && (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  {(() => {
                    const pendingStation = activityState?.plan.find(station => station.status === 'pending');
                    if (pendingStation) {
                      return `⏳ Verification pending at ${pendingStation.display_name}`;
                    }
                    
                    if (activity?.status === 'completed') {
                      return "🎉 Activity completed! All stations have been visited.";
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

            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>

        
        {/* Dev Panel */}
        {SIMULATION_MODE_ENV && (
          <DevPanel />
        )}
      </div>
    </div>
  );
};

export default ActivityCheckin;