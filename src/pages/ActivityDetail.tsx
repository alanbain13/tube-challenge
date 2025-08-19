import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, Play, Square, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ActivityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { stations } = useStations();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Helper function to get station name by TfL ID
  const getStationName = (tflId: string) => {
    const station = stations.find(s => s.id === tflId);
    return station ? station.name : tflId;
  };

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // Fetch activity details
  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  // Fetch station visits for this activity
  const { data: visits = [] } = useQuery({
    queryKey: ["activity_visits", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("station_visits")
        .select("*")
        .eq("activity_id", id)
        .order("sequence_number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  const handleStartJourney = async () => {
    if (!activity) return;
    
    try {
      const { error } = await supabase
        .from("activities")
        .update({ status: "active" })
        .eq("id", activity.id);

      if (error) throw error;

      toast({
        title: "Journey started",
        description: "Your activity is now active"
      });

      navigate(`/activities/${activity.id}/checkin`);
    } catch (error) {
      toast({
        title: "Error starting journey",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleFinishJourney = async () => {
    if (!activity) return;
    
    try {
      const { error } = await supabase
        .from("activities")
        .update({ 
          status: "completed",
          ended_at: new Date().toISOString()
        })
        .eq("id", activity.id);

      if (error) throw error;

      toast({
        title: "Journey completed",
        description: "Your activity has been marked as complete"
      });
    } catch (error) {
      toast({
        title: "Error finishing journey",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // SEO
  useEffect(() => {
    document.title = `${activity?.title || 'Activity'} | Tube Challenge`;
  }, [activity]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading activity...</p>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Activity not found</h2>
          <Button onClick={() => navigate("/activities")}>
            Back to Activities
          </Button>
        </div>
      </div>
    );
  }

  const statusText = activity.status === 'draft' ? 'Not started' : 
                    activity.status === 'active' ? 'Active' : 'Completed';
  
  const elapsedTime = activity.started_at && activity.ended_at ? 
    new Date(activity.ended_at).getTime() - new Date(activity.started_at).getTime() : 
    activity.started_at && activity.status === 'active' ? 
    Date.now() - new Date(activity.started_at).getTime() : 0;

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const stationList = activity.station_tfl_ids || [];
  const visitedStations = new Set(visits.map(v => v.station_tfl_id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate("/activities")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{activity.title || "Untitled Activity"}</h1>
              <p className="text-muted-foreground">Activity Details</p>
            </div>
          </div>
        </header>

        <main className="space-y-6">
          {/* Summary Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Route</div>
                  <div className="font-medium">
                    {activity.start_station_tfl_id && activity.end_station_tfl_id ? 
                      `${getStationName(activity.start_station_tfl_id)} → ${getStationName(activity.end_station_tfl_id)}` : 
                      'No route set'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={activity.status === 'completed' ? 'default' : 'outline'}>
                    {statusText}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Elapsed Time</div>
                  <div className="font-medium">{formatDuration(elapsedTime)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Distance</div>
                  <div className="font-medium">{activity.distance_km ? `${Number(activity.distance_km).toFixed(1)} km` : '0.0 km'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stations List */}
          <Card>
            <CardHeader>
              <CardTitle>Stations</CardTitle>
              <CardDescription>Journey progress through stations</CardDescription>
            </CardHeader>
            <CardContent>
              {stationList.length === 0 ? (
                <p className="text-muted-foreground">No stations defined for this activity</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {stationList.map((stationId: string, index: number) => {
                    const isVisited = visitedStations.has(stationId);
                    const visit = visits.find(v => v.station_tfl_id === stationId);
                    
                    return (
                      <div key={`${stationId}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{getStationName(stationId)}</div>
                            {visit && visit.visited_at && (
                              <div className="text-xs text-muted-foreground">
                                Visited {new Date(visit.visited_at).toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant={isVisited ? 'default' : 'outline'}>
                          {isVisited ? 'Visited' : 'Pending'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="sticky bottom-4 bg-background/80 backdrop-blur-sm border rounded-lg p-4">
            <div className="flex gap-2 justify-center">
              {activity.status === 'draft' && (
                <Button onClick={handleStartJourney} className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Start Journey
                </Button>
              )}
              {activity.status === 'active' && (
                <Button onClick={handleFinishJourney} variant="outline" className="flex items-center gap-2">
                  <Square className="w-4 h-4" />
                  Finish Journey
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => navigate(`/map?activity=${activity.id}`)}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View on Map
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ActivityDetail;