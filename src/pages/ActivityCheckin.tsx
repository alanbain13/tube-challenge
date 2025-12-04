import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, MapPin, Clock, CheckCircle, ArrowLeft, Loader2, XCircle, Upload } from "lucide-react";
import { useStations } from "@/hooks/useStations";
import { resolveStation, ResolvedStation } from "@/lib/stationResolver";
import { useImageUpload } from "@/hooks/useImageUpload";
import { extractImageGPS, extractImageTimestamp } from "@/lib/utils";

// Interface for derived activity state
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

// Verification status badge component
const VerificationBadge = ({ status }: { status: string }) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    location_verified: { label: "Location", className: "bg-green-500/20 text-green-700 border-green-300" },
    photo_verified: { label: "Photo", className: "bg-yellow-500/20 text-yellow-700 border-yellow-300" },
    remote_verified: { label: "Remote", className: "bg-blue-500/20 text-blue-700 border-blue-300" },
    failed: { label: "Failed", className: "bg-red-500/20 text-red-700 border-red-300" },
    pending: { label: "Pending", className: "bg-gray-500/20 text-gray-700 border-gray-300" },
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
};

const ActivityCheckin = () => {
  const { activityId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { stations } = useStations();
  
  // State
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedTimestamp, setCapturedTimestamp] = useState<Date | null>(null);
  const [exifGps, setExifGps] = useState<{ lat: number; lng: number } | null>(null);
  const [isCamera, setIsCamera] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{tfl_id: string, name: string, displayName: string, lines: string[]}> | null>(null);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadImage, isUploading } = useImageUpload();

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // Get device location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDeviceLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Location access denied:", error);
        }
      );
    }
  }, []);

  // Fetch activity state
  const { data: activityState } = useQuery({
    queryKey: ["activity_state", activityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('derive_activity_state', { 
        activity_id_param: activityId 
      });
      if (error) throw error;
      return data as unknown as DerivedActivityState;
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

  // Check if station is already checked in
  const isStationAlreadyVisited = (stationTflId: string): boolean => {
    return activityState?.actual_visits?.some(visit => visit.station_tfl_id === stationTflId) || false;
  };

  // Checkin mutation - updated for new verification system
  const checkinMutation = useMutation({
    mutationFn: async ({ 
      stationTflId, 
      imageUrl,
      thumbUrl,
      ocrPassed,
      stationNameMatched,
      aiStationText,
      aiConfidence,
    }: { 
      stationTflId: string; 
      imageUrl?: string;
      thumbUrl?: string;
      ocrPassed: boolean;
      stationNameMatched: boolean;
      aiStationText?: string;
      aiConfidence?: number;
    }) => {
      if (!user || !activity) throw new Error("Missing data");

      const loadTimestamp = new Date();
      
      // Call record-visit edge function with new verification fields
      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: activity.id,
          station_tfl_id: stationTflId,
          user_id: user.id,
          
          // OCR/AI verification results
          ocr_passed: ocrPassed,
          station_name_matched: stationNameMatched,
          ai_station_text: aiStationText,
          ai_confidence: aiConfidence,
          
          // Photo timestamp (EXIF)
          captured_at: capturedTimestamp?.toISOString() || null,
          exif_time_present: !!capturedTimestamp,
          
          // Load timestamp
          loaded_at: loadTimestamp.toISOString(),
          
          // EXIF GPS
          exif_lat: exifGps?.lat || null,
          exif_lng: exifGps?.lng || null,
          exif_gps_present: !!exifGps,
          
          // Device GPS at load time
          load_lat: deviceLocation?.lat || null,
          load_lon: deviceLocation?.lng || null,
          
          // Image URL
          verification_image_url: imageUrl || null,
          
          // Context
          checkin_type: 'image',
          verifier_version: '2.0'
        }
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to record visit');
      }

      if (!result.data?.success) {
        if (result.data?.error_code === 'duplicate_visit') {
          throw new Error(result.data.error || 'Already checked in to this station');
        }
        throw new Error(result.data?.error || 'Failed to record visit');
      }

      return {
        visit_id: result.data.visit_id,
        seq_actual: result.data.seq_actual,
        verification_status: result.data.verification_status,
        verification_method: result.data.verification_method,
        station_tfl_id: stationTflId
      };
    },
    onSuccess: async (data) => {
      const stationName = stations.find(s => s.id === data.station_tfl_id)?.displayName || data.station_tfl_id;
      
      // Show success toast with verification status
      const statusLabels: Record<string, string> = {
        location_verified: "📍 Location verified",
        photo_verified: "📷 Photo verified", 
        remote_verified: "🌐 Remote verified",
        failed: "❌ Verification failed"
      };
      
      toast.success(`Checked in at ${stationName}`, {
        description: `#${data.seq_actual} • ${statusLabels[data.verification_status] || data.verification_status}`,
        duration: 4000,
      });

      // Invalidate queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["activity_state", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activity", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activitiesList"] }),
      ]);

      // Clear state and navigate back
      setCapturedImage(null);
      setCapturedTimestamp(null);
      setExifGps(null);
      setVerificationError(null);
      setSuggestions(null);

      setTimeout(() => navigate(`/activities/${activityId}`), 300);
    },
    onError: (error: Error) => {
      console.error("Check-in failed:", error);
      
      if (error.message.includes('Already checked in') || error.message.includes('duplicate')) {
        toast.error("Already checked in", {
          description: "You've already checked in to this station for this activity.",
        });
      } else {
        toast.error("Check-in failed", {
          description: error.message,
        });
      }
    },
  });

  // Validation pipeline
  const runValidationPipeline = async (imageData: string) => {
    try {
      setIsVerifying(true);
      setVerificationError(null);
      setSuggestions(null);
      
      // Step 1: Extract EXIF data
      console.log('📸 Extracting EXIF data...');
      const [imageGPS, imageTimestamp] = await Promise.all([
        extractImageGPS(imageData),
        extractImageTimestamp(imageData)
      ]);
      
      setExifGps(imageGPS);
      setCapturedTimestamp(imageTimestamp);
      
      console.log('📸 EXIF:', { gps: imageGPS, timestamp: imageTimestamp });
      
      // Step 2: OCR verification
      console.log('🔍 Running OCR...');
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('verify-roundel', {
        body: { imageData }
      });

      if (ocrError) throw ocrError;

      if (ocrResult.pending) {
        throw new Error(ocrResult.message || "AI verification temporarily unavailable.");
      }

      const normalizedOCR: OCRResult = {
        is_roundel: ocrResult.is_roundel || ocrResult.success || false,
        station_text_raw: ocrResult.station_text_raw || ocrResult.text_seen || '',
        station_name: ocrResult.station_name,
        confidence: ocrResult.confidence || 0
      };

      if (!normalizedOCR.is_roundel) {
        throw new Error('Roundel not detected. Please take a clear photo of a station roundel.');
      }

      // Step 3: Station resolution
      console.log('🎯 Resolving station...');
      const resolverResult = resolveStation(
        normalizedOCR.station_text_raw,
        normalizedOCR.station_name,
        stations,
        deviceLocation ? { lat: deviceLocation.lat, lng: deviceLocation.lng } : undefined
      );

      if ('error' in resolverResult) {
        if (resolverResult.suggestions && resolverResult.suggestions.length > 0) {
          setSuggestions(resolverResult.suggestions.slice(0, 3).map(s => ({ 
            tfl_id: s.id, 
            name: s.name,
            displayName: s.displayName || s.name,
            lines: s.lines.map(l => l.name)
          })));
          throw new Error(`Station not found: "${normalizedOCR.station_text_raw}". Did you mean one of the suggestions below?`);
        }
        throw new Error(`Station not found: "${normalizedOCR.station_text_raw}"`);
      }

      const resolvedStation = resolverResult as ResolvedStation;
      
      // Check for duplicate
      if (isStationAlreadyVisited(resolvedStation.station_id)) {
        throw new Error(`Already checked in to ${resolvedStation.display_name} for this activity.`);
      }

      // Step 4: Upload image and record visit
      console.log('📤 Uploading image...');
      const fileName = `${user?.id}/${activityId}/${Date.now()}-roundel.jpg`;
      const uploadResult = await uploadImage(imageData, fileName);
      
      if (!uploadResult) {
        throw new Error('Failed to upload image');
      }

      // Step 5: Record visit via edge function
      console.log('💾 Recording visit...');
      await checkinMutation.mutateAsync({
        stationTflId: resolvedStation.station_id,
        imageUrl: uploadResult.imageUrl,
        thumbUrl: uploadResult.thumbUrl,
        ocrPassed: true,
        stationNameMatched: true,
        aiStationText: normalizedOCR.station_text_raw,
        aiConfidence: normalizedOCR.confidence,
      });

    } catch (error: any) {
      console.error('❌ Validation failed:', error.message);
      setVerificationError(error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestionTflId: string) => {
    if (!capturedImage || !user) return;
    
    if (isStationAlreadyVisited(suggestionTflId)) {
      const stationName = stations.find(s => s.id === suggestionTflId)?.displayName || suggestionTflId;
      toast.error(`Already checked in to ${stationName}`);
      return;
    }
    
    setIsVerifying(true);
    try {
      const fileName = `${user.id}/${activityId}/${Date.now()}-roundel.jpg`;
      const uploadResult = await uploadImage(capturedImage, fileName);
      
      if (!uploadResult) throw new Error('Failed to upload image');
      
      await checkinMutation.mutateAsync({
        stationTflId: suggestionTflId,
        imageUrl: uploadResult.imageUrl,
        thumbUrl: uploadResult.thumbUrl,
        ocrPassed: true,
        stationNameMatched: true, // User confirmed
        aiStationText: undefined,
        aiConfidence: undefined,
      });
    } catch (error: any) {
      toast.error("Check-in failed", { description: error.message });
    } finally {
      setIsVerifying(false);
    }
  };

  // Camera handlers
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
      toast.error("Camera access denied", {
        description: "Please allow camera access or upload a photo instead.",
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
        
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
        
        // Pre-extract EXIF
        const [gps, timestamp] = await Promise.all([
          extractImageGPS(imageData),
          extractImageTimestamp(imageData)
        ]);
        setExifGps(gps);
        setCapturedTimestamp(timestamp);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedTimestamp(null);
    setExifGps(null);
    setVerificationError(null);
    setSuggestions(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Loading states
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

  const canUpload = activity.status !== 'completed' && !isVerifying && !isUploading && !checkinMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/activities/${activityId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Activity Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{activity.title || 'Station Check-in'}</CardTitle>
              <Badge variant="outline" className="capitalize">{activity.status}</Badge>
            </div>
            <CardDescription>
              Take a photo of a station roundel to check in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{activityState?.counts.visited_actual || 0} stations visited</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {activity.started_at 
                    ? new Date(activity.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Not started'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Expected Station - for planned routes */}
        {activityState?.plan && activityState.plan.length > 0 && (() => {
          const nextStation = activityState.plan.find(s => s.status === 'not_visited');
          if (!nextStation) return null;
          
          return (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    {nextStation.sequence}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Next expected station</p>
                    <p className="font-medium">{nextStation.display_name}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {activityState.counts.visited_actual}/{activityState.plan.length}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Camera/Upload Section */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Camera Interface */}
            {isCamera && (
              <div className="space-y-3">
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
              </div>
            )}

            {/* Upload Options */}
            {canUpload && !capturedImage && !isCamera && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={startCamera}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  variant="outline"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-sm">Take Photo</span>
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  variant="outline"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">Upload</span>
                </Button>
              </div>
            )}

            {/* Captured Image Preview */}
            {capturedImage && (
              <div className="space-y-3">
                <img 
                  src={capturedImage} 
                  alt="Captured roundel" 
                  className="w-full rounded-lg"
                />
                
                {/* EXIF Info */}
                {(capturedTimestamp || exifGps) && (
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {capturedTimestamp && (
                      <span>📅 {capturedTimestamp.toLocaleString()}</span>
                    )}
                    {exifGps && (
                      <span>📍 GPS found</span>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => runValidationPipeline(capturedImage)}
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
                  <Button variant="outline" onClick={handleRetake}>
                    Retake
                  </Button>
                </div>

                {/* Error Display */}
                {verificationError && (
                  <div className="p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <p className="text-sm text-destructive">{verificationError}</p>
                        
                        {/* Station Suggestions */}
                        {suggestions && suggestions.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {suggestions.map((suggestion) => (
                                <Button
                                  key={suggestion.tfl_id}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSuggestionSelect(suggestion.tfl_id)}
                                  disabled={isVerifying}
                                  className="text-xs"
                                >
                                  {suggestion.displayName}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Completed State */}
            {activity.status === 'completed' && (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>Activity completed</p>
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

        {/* Recent Visits */}
        {activityState?.actual_visits && activityState.actual_visits.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activityState.actual_visits
                  .slice(-3)
                  .reverse()
                  .map((visit) => (
                    <div key={visit.station_tfl_id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{visit.sequence}</Badge>
                        <span className="font-medium">{visit.display_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(visit.visited_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ActivityCheckin;
