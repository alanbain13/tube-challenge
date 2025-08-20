import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, MapPin, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useStations } from "@/hooks/useStations";
import { resolveStation, ResolvedStation } from "@/lib/stationResolver";

// Helper functions
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const fuzzyMatch = (str1: string, str2: string): number => {
  // Simple Jaro-Winkler similarity implementation
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const a = normalize(str1);
  const b = normalize(str2);
  
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  // Calculate simple similarity based on common substrings
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1: string, str2: string): number => {
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

  // AI Roundel verification  
  const verifyRoundelMutation = useMutation({
    mutationFn: async ({ imageData }: { imageData: string }) => {
      console.log('🧭 Checkin: image bytes size=', imageData.length);
      const { data, error } = await supabase.functions.invoke('verify-roundel', {
        body: { imageData }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      console.log('🧭 Checkin: OCR result =', result);
      setIsVerifying(false);
      
      // Handle different response scenarios
      if (result.pending) {
        // AI is unavailable or disabled - save as pending
        const fallbackStation = nearbyStations[0];
        if (fallbackStation) {
          checkinMutation.mutate({
            stationTflId: fallbackStation.tfl_id,
            checkinType: 'image',
            imageData: capturedImage!,
            verificationResult: { success: false, pending: true }
          });
        }
        
        if (result.setup_required) {
          toast({
            title: "⚙️ Setup Required",
            description: "AI verification not configured. Photo saved as pending.",
            duration: 5000,
          });
        } else {
          toast({
            title: "📋 Saved as Pending", 
            description: result.message,
            duration: 4000,
          });
        }
        return;
      }

      // Normalize AI response to expected contract
      const normalizedResult = {
        is_roundel: result.success || false,
        station_text_raw: result.station_name || result.text_seen || '',
        station_name: result.station_name,
        confidence: result.confidence || 0
      };

      // Check if roundel was detected
      if (!result.is_roundel) {
        toast({
          title: "No roundel detected",
          description: result.message || "Try a clearer photo of the station roundel",
          variant: "destructive"
        });
        setVerificationError("No TfL roundel detected in image");
        return;
      }

      // Use centralized station resolver
      const stationTextRaw = result.station_text_raw || result.text_seen || '';
      const stationName = result.station_name;
      
      console.log('🧭 Checkin: Resolving station:', { stationTextRaw, stationName });
      
      const resolverResult = resolveStation(
        stationTextRaw,
        stationName,
        stations,
        location ? { lat: location.lat, lng: location.lng } : undefined
      );

      // Handle resolver error (no match found)
      if ('error' in resolverResult) {
        console.log('🧭 Checkin: Station resolver failed:', resolverResult.error);
        
        // Show error with suggestions if available
        if (resolverResult.suggestions && resolverResult.suggestions.length > 0) {
          const suggestionNames = resolverResult.suggestions.map(s => s.name).join(', ');
          toast({
            title: "Station not recognized",
            description: `${resolverResult.error}. Did you mean: ${suggestionNames}?`,
            variant: "destructive"
          });
          setSuggestions(resolverResult.suggestions.map(s => ({ tfl_id: s.id, name: s.name })));
        } else {
          toast({
            title: "Station not recognized", 
            description: result.message || resolverResult.error,
            variant: "destructive"
          });
        }
        
        setVerificationError(resolverResult.error);
        return;
      }

      // Success - we have a resolved station
      const resolvedStation = resolverResult as ResolvedStation;
      
      console.log('🧭 Checkin: Station resolved:', {
        station_tfl_id: resolvedStation.station_id,
        display_name: resolvedStation.display_name,
        matching_rule: resolvedStation.matching_rule,
        confidence: result.confidence
      });

      // Create verified check-in
      checkinMutation.mutate({
        stationTflId: resolvedStation.station_id,
        checkinType: 'image',
        imageData: capturedImage!,
        verificationResult: {
          success: true,
          pending: false,
          station_name: resolvedStation.display_name,
          confidence: result.confidence,
          distance_m: 0, // Resolver handles distance internally
          verification_method: 'ai_image',
          ai_station_text: stationTextRaw,
          ai_confidence: result.confidence,
          matching_rule: resolvedStation.matching_rule
        }
      });

      setVerificationError(null);
      setSuggestions(null);
      
      // Show simulation notice if applicable
      if (result.debug?.simulation) {
        toast({
          title: "🧪 Simulation Mode",
          description: "Using simulated AI verification for development",
          duration: 3000,
        });
      }
    },
    onError: (error: any) => {
      console.error('🧭 Checkin: AI verification error:', error);
      setIsVerifying(false);
      
      // Save as pending on error
      const fallbackStation = nearbyStations[0];
      if (fallbackStation) {
        checkinMutation.mutate({
          stationTflId: fallbackStation.tfl_id,
          checkinType: 'image', 
          imageData: capturedImage!,
          verificationResult: { success: false, pending: true }
        });
      }
      
      toast({
        title: "📋 Saved as Pending",
        description: "Verification failed. Photo saved for manual review.",
        duration: 4000,
      });
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
      
      // Determine status and verification method
      let status = 'verified';
      let verificationMethod = 'gps';
      
      if (checkinType === 'image') {
        verificationMethod = 'ai_image';
        status = verificationResult?.success ? 'verified' : 'pending';
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

      const { data, error } = await supabase
        .from("station_visits")
        .insert(visitData)
        .select()
        .single();

      if (error) {
        console.error('🧭 Checkin: insert error =', error);
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
      
      if (variables.checkinType === 'image') {
        const isVerified = variables.verificationResult?.success;
        if (isVerified) {
          toast({
            title: "✅ Checked in at " + variables.verificationResult?.station_name,
            description: `Verification: ${variables.verificationResult?.matching_rule || 'AI match'}`,
          });
        } else {
          toast({
            title: "📋 Pending verification", 
            description: "Photo saved for review. You can proceed.",
            className: "border-yellow-200 bg-yellow-50",
          });
        }
      } else {
        toast({
          title: "Station checked in",
          description: "Your visit has been recorded.",
        });
      }
      
      setCapturedImage(null);
      setIsCamera(false);
      setVerificationError(null);
      setSuggestions(null);
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

                  {verificationError && (
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
                  
                   <div className="flex gap-2">
                     <Button
                       variant="outline"
                       onClick={() => {
                         setCapturedImage(null);
                         setVerificationError(null);
                         setSuggestions(null);
                       }}
                       className="flex-1"
                       disabled={isVerifying}
                     >
                       Retake
                     </Button>
                     {!verificationError && (
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