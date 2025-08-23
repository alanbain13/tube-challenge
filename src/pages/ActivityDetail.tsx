import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, Play, Square, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

const ActivityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { stations } = useStations();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; activityId: string; title: string }>({
    open: false,
    activityId: "",
    title: ""
  });
  const [isDeleting, setIsDeleting] = useState(false);

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
  const { data: activity, isLoading, refetch: refetchActivity } = useQuery({
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
      // Get the last visited station to set as finish
      const lastVisit = [...visits]
        .filter(v => v.status === 'verified')
        .sort((a, b) => new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime())
        .pop();

      // Remove unvisited stations from the plan
      const visitedStationIds = visits
        .filter(v => v.status === 'verified')
        .map(v => v.station_tfl_id);

      const { error } = await supabase
        .from("activities")
        .update({ 
          status: "completed",
          ended_at: new Date().toISOString(),
          end_station_tfl_id: lastVisit?.station_tfl_id || activity.end_station_tfl_id,
          station_tfl_ids: visitedStationIds.length > 0 ? visitedStationIds : activity.station_tfl_ids
        })
        .eq("id", activity.id);

      if (error) throw error;

      toast({
        title: "Journey completed",
        description: "Activity finished at " + (lastVisit ? getStationName(lastVisit.station_tfl_id) : "current position")
      });

      refetchActivity();
    } catch (error) {
      console.error('Error finishing journey:', error);
      toast({
        title: "Error finishing journey",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleDeleteActivity = async () => {
    if (!deleteModal.activityId) return;
    
    setIsDeleting(true);
    try {
      // First delete related station visits
      const { error: visitsError } = await supabase
        .from("station_visits")
        .delete()
        .eq("activity_id", deleteModal.activityId);
      
      if (visitsError) throw visitsError;

      // Then delete the activity
      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", deleteModal.activityId);

      if (error) throw error;

      toast({
        title: "Activity deleted",
        description: "The activity has been removed"
      });

      navigate("/activities");
    } catch (error) {
      toast({
        title: "Error deleting activity",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
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
                  <div className="font-medium">
                    {activity.actual_duration_minutes ? 
                      `${Math.floor(activity.actual_duration_minutes / 60).toString().padStart(2, '0')}:${(activity.actual_duration_minutes % 60).toString().padStart(2, '0')}:00` :
                      formatDuration(elapsedTime)
                    }
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Visited Count</div>
                  <div className="font-medium">{visits.filter(v => v.status === 'verified').length}/{stationList.length} stations</div>
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
                     const visit = visits.find(v => v.station_tfl_id === stationId);
                     const visitStatus = visit?.status === 'verified' ? 'visited' : 
                                       visit?.status === 'pending' ? 'pending' : 'not_visited';
                     
                     const statusColor = visitStatus === 'visited' ? 'bg-red-500' : 
                                       visitStatus === 'pending' ? 'bg-pink-500' : 'bg-white border-2 border-gray-300';
                     
                     return (
                       <div key={`${stationId}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                         <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${statusColor} ${visitStatus === 'not_visited' ? 'text-gray-600' : 'text-white'}`}>
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
                         <Badge variant={visitStatus === 'visited' ? 'default' : visitStatus === 'pending' ? 'secondary' : 'outline'}>
                           {visitStatus === 'visited' ? 'Visited' : visitStatus === 'pending' ? 'Pending' : 'Not visited'}
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
                 <>
                   <Button onClick={() => navigate(`/activities/${activity.id}/checkin`)} className="flex items-center gap-2">
                     <Play className="w-4 h-4" />
                     Continue Check-in
                   </Button>
                   <Button onClick={handleFinishJourney} variant="outline" className="flex items-center gap-2">
                     <Square className="w-4 h-4" />
                     Finish Activity
                   </Button>
                 </>
               )}
              <Button 
                variant="outline" 
                onClick={() => navigate(`/activities/${activity.id}/map`)}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View on Map
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setDeleteModal({ 
                  open: true, 
                  activityId: activity.id, 
                  title: activity.title || "Untitled Activity" 
                })}
                className="flex items-center gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Delete Activity
              </Button>
            </div>
          </div>
        </main>
        
        <DeleteConfirmModal
          open={deleteModal.open}
          onOpenChange={(open) => setDeleteModal(prev => ({ ...prev, open }))}
          title="Delete this Activity?"
          description="This action can't be undone. You'll lose this activity and its local progress."
          onConfirm={handleDeleteActivity}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
};

export default ActivityDetail;