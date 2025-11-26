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
  warnings?: {
    empty_plan?: boolean;
  };
}

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
    return station ? station.displayName : tflId;
  };

  // Auth guard and navigation logging
  useEffect(() => {
    console.log(`🧭 ActivityPage enter id=${id} user=${user?.id || 'none'}`);
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate, id]);

  // Fetch activity with derived state (single source of truth)
  const { data: activityState, isLoading, refetch: refetchActivityState } = useQuery({
    queryKey: ["activity_state", id],
    queryFn: async () => {
      console.log(`🔍 ActivityDetail: Fetching state for activity ${id}`);
      const { data, error } = await supabase.rpc('derive_activity_state', { 
        activity_id_param: id 
      });
      if (error) {
        console.error(`❌ DerivedState error for ${id}:`, error);
        throw error;
      }
      
      const derivedState = data as unknown as DerivedActivityState;
      const warnings = derivedState.warnings || {};
      console.log("📊 DerivedState result:", {
        id, 
        planned: derivedState.counts.planned_total, 
        visited: derivedState.counts.visited_actual, 
        actual_visits: derivedState.actual_visits?.length || 0, 
        warnings,
        full_state: derivedState
      });
      return derivedState;
    },
    enabled: !!user && !!id,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch to get latest state
  });

  // Get basic activity info for other operations
  const { data: activity, refetch: refetchActivity } = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => {
    const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
    staleTime: 0, // Always refetch to get latest state
  });

  // Auto-refetch when returning to this page (especially from check-in)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 ActivityDetail page focused, refetching data...');
      refetchActivityState();
      refetchActivity();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 ActivityDetail page visible, refetching data...');
        refetchActivityState();
        refetchActivity();
      }
    };

    // Listen for page focus and visibility changes
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refetch when component mounts (user navigates back)
    const timeoutId = setTimeout(() => {
      console.log('🔄 ActivityDetail mounted, refetching data...');
      refetchActivityState();
      refetchActivity();
    }, 100);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timeoutId);
    };
  }, [refetchActivityState, refetchActivity]);

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

      refetchActivityState(); // Refresh state after status change
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
    if (!activity || !activityState) return;
    
    try {
      // Get the last visited station from actual visits (chronological order)
      const lastVisited = activityState.actual_visits?.[activityState.actual_visits.length - 1];

      const { error } = await supabase
        .from("activities")
        .update({ 
          status: "completed",
          ended_at: new Date().toISOString(),
          end_station_tfl_id: lastVisited?.station_tfl_id || activity.end_station_tfl_id
        })
        .eq("id", activity.id);

      if (error) throw error;

      toast({
        title: "Journey completed",
        description: "Activity finished" + (lastVisited ? ` at ${getStationName(lastVisited.station_tfl_id)}` : "")
      });

      refetchActivityState();
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

  if (!activity || !activityState) {
    // Enhanced error handling with specific diagnostics
    const isOwnershipIssue = activity && activity.user_id !== user?.id;
    const hasEmptyPlan = activityState && activityState.counts.planned_total === 0;
    const activityExists = !!activity;
    const stateExists = !!activityState;
    
    let errorTitle = "Activity not found";
    let errorDescription = "The requested activity could not be found";
    
    if (activityExists && isOwnershipIssue) {
      errorTitle = "Not your activity";
      errorDescription = "This activity belongs to another user";
    } else if (activityExists && stateExists && hasEmptyPlan) {
      errorTitle = "Empty activity plan";
      errorDescription = "This activity has no planned stations. You can edit it to add stations.";
    } else if (activityExists && !stateExists) {
      errorTitle = "Activity state error";
      errorDescription = `Activity exists but state derivation failed. Please reload.`;
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4">{errorTitle}</h2>
          <p className="text-muted-foreground mb-6">{errorDescription}</p>
          <div className="space-x-2">
            <Button onClick={() => navigate("/activities")}>
              Reload Activities
            </Button>
            {activityExists && hasEmptyPlan && (
              <Button variant="outline" onClick={() => navigate(`/activities/${activity.id}/edit`)}>
                Edit Activity
              </Button>
            )}
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
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

  // Use derived state for all UI rendering
  const { plan, counts, actual_visits } = activityState;
  
  // Log free-order mode state
  console.log(`HUD: Free-order mode | planned=${counts.planned_total} visited=${counts.visited_actual} actual_visits=${actual_visits?.length || 0} (version=${activityState.version})`);

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
                  <div className="font-medium">
                    {counts.visited_actual}/{counts.planned_total > 0 ? counts.planned_total : 'Open'} stations
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Empty Plan Info - Updated for free-order mode */}
          {activityState.counts.planned_total === 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">Unplanned Activity</CardTitle>
                <CardDescription className="text-blue-700">
                  This activity has no planned route. You can check in at any station to build your journey as you go.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button onClick={() => navigate(`/activities/${activity.id}/edit`)} variant="outline">
                  Add Planned Route
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteModal({ 
                    open: true, 
                    activityId: activity.id, 
                    title: activity.title || "Untitled Activity" 
                  })}
                  className="text-destructive hover:text-destructive"
                >
                  Delete Activity
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Stations List - Free-order mode */}
          <Card>
            <CardHeader>
              <CardTitle>Journey Progress</CardTitle>
              <CardDescription>Check in at any station to continue your activity.</CardDescription>
            </CardHeader>
          <CardContent className="space-y-6">
            {/* Actual Visits (chronological order) */}
            {actual_visits && actual_visits.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 text-red-700">Visited Stations (in order)</h4>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {actual_visits.map((visit, index) => (
                    <div key={`visit-${visit.station_tfl_id}-${index}`} className="flex items-center justify-between p-3 border rounded-lg bg-red-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-medium">
                          {visit.sequence}
                        </div>
                        <div>
                          <div className="font-medium">{getStationName(visit.station_tfl_id)}</div>
                          <div className="text-xs text-muted-foreground">
                            Visited {new Date(visit.visited_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-red-500 text-white">Visited</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Planned Route (if exists) */}
            {plan.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 text-blue-700">Planned Route {plan.length > 0 ? '(reference only)' : ''}</h4>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {plan.map((station) => {
                    const statusColor = station.status === 'verified' ? 'bg-red-500' : 'bg-blue-500';
                    const textColor = station.status === 'verified' ? 'text-white' : 'text-white';
                    const bgColor = station.status === 'verified' ? 'bg-red-50' : 'bg-blue-50';
                    
                    return (
                      <div key={`plan-${station.station_tfl_id}-${station.sequence}`} className={`flex items-center justify-between p-3 border rounded-lg ${bgColor}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${statusColor} ${textColor}`}>
                            {station.sequence}
                          </div>
                          <div>
                            <div className="font-medium">{getStationName(station.station_tfl_id)}</div>
                          </div>
                        </div>
                        <Badge variant={station.status === 'verified' ? 'default' : 'outline'} className={station.status === 'verified' ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-700 border-blue-300'}>
                          {station.status === 'verified' ? 'Visited' : 'Not visited'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {plan.length === 0 && (!actual_visits || actual_visits.length === 0) && (
              <p className="text-muted-foreground">No stations visited or planned for this activity</p>
            )}
            </CardContent>
          </Card>

          {/* Actions - Free-order mode */}
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
                      {activityState.counts.planned_total === 0 ? 'Continue Check-in' : 'Continue Check-in'}
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