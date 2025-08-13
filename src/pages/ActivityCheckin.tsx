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

const ActivityCheckin = () => {
  const { activityId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCamera, setIsCamera] = useState(false);

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

  // Checkin mutation
  const checkinMutation = useMutation({
    mutationFn: async ({ 
      stationTflId, 
      checkinType, 
      imageData 
    }: { 
      stationTflId: string; 
      checkinType: 'gps' | 'image' | 'manual';
      imageData?: string;
    }) => {
      if (!user || !activity) throw new Error("Missing data");

      const sequenceNumber = (activity.station_visits?.length || 0) + 1;
      
      const visitData = {
        user_id: user.id,
        activity_id: activity.id,
        station_tfl_id: stationTflId,
        sequence_number: sequenceNumber,
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        checkin_type: checkinType,
        verification_image_url: imageData || null,
        status: checkinType === 'image' ? 'pending' : 'verified',
        visited_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("station_visits")
        .insert(visitData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      toast({
        title: "Station checked in",
        description: "Your visit has been recorded.",
      });
      setCapturedImage(null);
      setIsCamera(false);
    },
    onError: (error: any) => {
      toast({
        title: "Checkin failed",
        description: error?.message || "Please try again.",
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

  const handleGpsCheckin = (stationTflId: string) => {
    checkinMutation.mutate({
      stationTflId,
      checkinType: 'gps',
    });
  };

  const handleImageCheckin = (stationTflId: string) => {
    if (capturedImage) {
      checkinMutation.mutate({
        stationTflId,
        checkinType: 'image',
        imageData: capturedImage,
      });
    } else {
      toast({
        title: "No image captured",
        description: "Please take a photo first.",
        variant: "destructive",
      });
    }
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
                Roundel Image Capture
              </CardTitle>
              <CardDescription>
                Take a photo of the station roundel for verification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isCamera && !capturedImage && (
                <Button onClick={startCamera} className="w-full">
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCapturedImage(null)}
                      className="flex-1"
                    >
                      Retake
                    </Button>
                    <Button onClick={startCamera} variant="outline" className="flex-1">
                      New Photo
                    </Button>
                  </div>
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
                          <Button
                            size="sm"
                            onClick={() => handleImageCheckin(station.tfl_id)}
                            disabled={!capturedImage || checkinMutation.isPending || isVisited}
                          >
                            <Camera className="w-4 h-4 mr-1" />
                            Image
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