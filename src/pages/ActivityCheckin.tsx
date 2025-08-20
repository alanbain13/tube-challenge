import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, MapPin, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { useStations } from "@/hooks/useStations";
import { resolveStation, ResolvedStation } from "@/lib/stationResolver";

// Configuration
const GEOFENCE_RADIUS_METERS = parseInt(import.meta.env.VITE_GEOFENCE_RADIUS_METERS || '500', 10);
const SIMULATION_MODE = import.meta.env.DEV || import.meta.env.VITE_SIMULATION_MODE === 'true';

console.log('🧭 Checkin: Config loaded -', { 
  GEOFENCE_RADIUS_METERS, 
  SIMULATION_MODE, 
  isDev: import.meta.env.DEV 
});

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
  simulation_mode: boolean;
  result: 'success' | 'error';
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
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCamera, setIsCamera] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{tfl_id: string, name: string}> | null>(null);
  const [showCheckinFlow, setShowCheckinFlow] = useState(false);
  const [geofenceError, setGeofenceError] = useState<{ 
    message: string; 
    code: string; 
    resolvedStation?: ResolvedStation; 
    distance?: number;
    ocrResult?: OCRResult;
  } | null>(null);

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

  // 3-Step Validation Pipeline
  const runValidationPipeline = async (imageData: string) => {
    const logEntry: ValidationLogEntry = {
      step: 'ocr',
      simulation_mode: SIMULATION_MODE,
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

      if (SIMULATION_MODE) {
        console.log('🧭 Checkin: Step 3 - Geofencing SKIPPED (simulation mode)');
        logEntry.result = 'success';
        logEntry.geofence_bypassed = true;
        logEntry.error_message = 'Skipped in simulation mode';
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

      // STEP 4: Persist Visit
      logEntry.step = 'persist';
      logEntry.result = 'error';

      console.log('🧭 Checkin: Step 4 - Persist visit');
      
      await checkinMutation.mutateAsync({
        stationTflId: resolvedStation.station_id,
        checkinType: 'image',
        imageData: capturedImage!,
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
          simulation_mode: SIMULATION_MODE,
          geofence_distance_m: logEntry.distance_m || 0,
          geofence_radius_m: GEOFENCE_RADIUS_METERS,
          geofence_passed: logEntry.geofence_passed || false,
          geofence_bypassed: logEntry.geofence_bypassed || false
        }
      });

      logEntry.result = 'success';
      console.log('🧭 Checkin: Step 4 SUCCESS -', logEntry);

      // Success toast
      const simulationSuffix = SIMULATION_MODE ? ' (simulation)' : '';
      toast({
        title: `✅ Checked in at ${resolvedStation.display_name}${simulationSuffix}`,
        description: `Verification: ${resolvedStation.matching_rule}`,
      });

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
      setShowCheckinFlow(false);
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
      verificationResult
    }: { 
      stationTflId: string; 
      checkinType: 'gps' | 'image' | 'manual';
      imageData?: string;
      verificationResult?: any;
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
        verification_image_url: imageData || null,
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
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      
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
      setShowCheckinFlow(false);
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
      setIsVerifying(true);
      setVerificationError(null);
      setSuggestions(null);
      verifyRoundelMutation.mutate({ imageData: capturedImage });
    } else {
      toast({
        title: "No image captured",
        description: "Please take a photo first.",
        variant: "destructive",
      });
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

  const getStationName = (tflId: string) => {
    // Try to find station name from nearby stations first
    const nearbyStation = nearbyStations.find((s: any) => s.tfl_id === tflId);
    if (nearbyStation) return nearbyStation.name;
    
    // Fallback to tfl_id if name not found
    return tflId;
  };

  if (loading || activityLoading || !user || !activity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Activity Checkin</h1>
            <p className="text-muted-foreground">{activity.title}</p>
            {activity.route && (
              <Badge variant="outline" className="mt-1">
                Route: {activity.route.name}
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={() => navigate(`/activities/${activityId}`)}>
            Back to Activity
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Check-in with Roundel Photo
              </CardTitle>
            <CardDescription>
              Take or upload a photo of the station roundel to verify your check-in
              {SIMULATION_MODE && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-orange-800 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Simulation mode is ON — GPS checks bypassed
                </div>
              )}
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!location && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                  <MapPin className="w-4 h-4" />
                  GPS not available; we'll rely on image only.
                </div>
              )}
              
              {!showCheckinFlow && !isCamera && !capturedImage && (
                <div className="space-y-4">
                  <Button onClick={() => setShowCheckinFlow(true)} className="w-full">
                    Check-in with Roundel Photo
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    Take or upload a photo of the station roundel to verify your location
                  </p>
                </div>
              )}

              {showCheckinFlow && !isCamera && !capturedImage && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={startCamera} className="flex-1">
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      Upload Image
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCheckinFlow(false);
                      setCapturedImage(null);
                      setVerificationError(null);
                      setSuggestions(null);
                      setGeofenceError(null);
                    }}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {isCamera && (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg border"
                  />
                  <Button onClick={capturePhoto} className="w-full">
                    Capture Photo
                  </Button>
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
                         className="flex-1"
                         disabled={isVerifying || checkinMutation.isPending}
                       >
                         {isVerifying ? (
                           <>
                             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                             Verifying...
                           </>
                         ) : (
                           'Continue'
                         )}
                       </Button>
                     )}
                   </div>
                   
                   {/* GPS Fallback Button */}
                   {nearbyStations.length > 0 && (
                     <Button
                       variant="ghost"
                       onClick={() => handleGpsCheckin(nearbyStations[0].tfl_id)}
                       className="w-full mt-2"
                       disabled={checkinMutation.isPending}
                     >
                       <MapPin className="w-4 h-4 mr-2" />
                       Use GPS only
                     </Button>
                   )}
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </CardContent>
          </Card>

          {/* Nearby Stations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Nearby Stations
              </CardTitle>
              <CardDescription>
                Stations within 500m of your location
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!location ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Getting your location...
                </div>
              ) : nearbyStations.length === 0 ? (
                <p className="text-muted-foreground">No stations found nearby</p>
              ) : (
                <div className="space-y-3">
                  {nearbyStations.map((station: any) => {
                    const isVisited = activity.station_visits?.some(
                      (visit: any) => visit.station_tfl_id === station.tfl_id
                    );
                    
                    return (
                      <div
                        key={station.tfl_id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{station.name}</h3>
                            {isVisited && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Zone {station.zone} · {Math.round(station.distance * 1000)}m away
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGpsCheckin(station.tfl_id)}
                            disabled={checkinMutation.isPending || isVisited}
                          >
                            <MapPin className="w-4 h-4 mr-1" />
                            GPS
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Activity Status */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Activity Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {activity.station_visits?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Stations Visited</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {activity.estimated_duration_minutes || 'N/A'}
                  </p>
                  <p className="text-sm text-muted-foreground">Est. Duration (min)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {activity.started_at ? Math.round((Date.now() - new Date(activity.started_at).getTime()) / 60000) : 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Elapsed (min)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary capitalize">
                    {activity.timing_mode?.replace('_', ' ') || 'Open'}
                  </p>
                  <p className="text-sm text-muted-foreground">Mode</p>
                </div>
              </div>

              {activity.station_visits && activity.station_visits.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Recent Visits</h4>
                  <div className="space-y-1">
                    {activity.station_visits
                      .sort((a: any, b: any) => b.sequence_number - a.sequence_number)
                      .slice(0, 5)
                      .map((visit: any) => (
                        <div key={visit.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                          <span>#{visit.sequence_number} - {visit.station_tfl_id}</span>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={visit.status === 'verified' ? 'default' : visit.status === 'pending' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {visit.status}
                            </Badge>
                            <span className="text-muted-foreground">
                              {new Date(visit.visited_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ActivityCheckin;