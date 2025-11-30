import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Clock, Play, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ActivityStartModal from "@/components/ActivityStartModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { ActivityTileMiniMap } from "@/components/ActivityTileMiniMap";
import { AppLayout } from "@/components/AppLayout";

const Activities = () => {
  const { user, loading } = useAuth();
  const { stations } = useStations();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showActivityModal, setShowActivityModal] = useState(false);
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

  // Helper function to get unified activity state
  const getUnifiedActivityState = async (activityId: string) => {
    try {
      // Get activity plan items (for planned activities)
      const { data: planItems, error: planError } = await supabase
        .from('activity_plan_item')
        .select('station_tfl_id, seq_planned')
        .eq('activity_id', activityId);

      if (planError) throw planError;

      // Get station visits (verified and pending only)
      const { data: visits, error: visitsError } = await supabase
        .from('station_visits')
        .select('station_tfl_id, status')
        .eq('activity_id', activityId)
        .in('status', ['verified', 'pending']);

      if (visitsError) throw visitsError;

      const visitedCount = visits?.length || 0;
      const totalPlannedCount = planItems?.length || 0;

      return {
        visited_actual: visitedCount,
        planned_total: totalPlannedCount
      };
    } catch (error) {
      console.error('Error getting unified activity state:', error);
      return { visited_actual: 0, planned_total: 0 };
    }
  };

  // Page entry logging and auth guard
  useEffect(() => {
    console.log(`🧭 ActivityPage enter id=dashboard user=${user?.id || 'none'}`);
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // SEO
  useEffect(() => {
    document.title = "Activities | Tube Challenge";
    const desc = "View and manage your tube journey activities and challenges.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  // Fetch user's activities with derived state, listen for updates
  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      
      // Get unified state for each activity
      const activitiesWithState = await Promise.all(
        data.map(async (activity) => {
          const unifiedState = await getUnifiedActivityState(activity.id);
          return {
            ...activity,
            _unifiedState: unifiedState
          };
        })
      );
      
      return activitiesWithState;
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 30000, // 30 seconds - allow some staleness for better UX
  });

  // Listen for activity state changes from check-ins
  useEffect(() => {
    const handleActivityChange = () => {
      console.log('🔄 Activity state changed, refetching activities...');
      refetch();
    };
    
    window.addEventListener('activity-state-changed', handleActivityChange);
    return () => window.removeEventListener('activity-state-changed', handleActivityChange);
  }, [refetch]);

  const handleStartOrResumeActivity = async (activityId: string, currentStatus: string) => {
    try {
      console.log(`🧭 NAV: Starting/resuming activity - id=${activityId} status=${currentStatus}`);
      
      // If starting a new activity, pause any currently active activities
      if (currentStatus === 'draft') {
        const { error: pauseError } = await supabase
          .from("activities")
          .update({ status: 'paused' })
          .eq('user_id', user!.id)
          .eq('status', 'active');

        if (pauseError) throw pauseError;
        
        // Update the current activity to active
        const { error: activateError } = await supabase
          .from("activities")
          .update({ status: 'active' })
          .eq('id', activityId);
          
        if (activateError) throw activateError;
        
        console.log(`Activity ${activityId} activated`);
      }

      console.log(`🧭 NAV: Navigating to activity checkin: ${activityId}`);
      navigate(`/activities/${activityId}/checkin`);
    } catch (error) {
      console.error('Error starting activity:', error);
      toast({
        title: "Error starting activity",
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
        description: "The activity and its progress have been removed"
      });

      setDeleteModal({ open: false, activityId: "", title: "" });
      refetch();
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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <AppLayout>
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Activities</h1>
            <p className="text-muted-foreground">Your tube journey activities and challenges</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowActivityModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Activity
            </Button>
          </div>
        </header>

        <main>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-lg text-muted-foreground">Loading activities...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <h2 className="text-xl font-semibold mb-4">No activities yet</h2>
                <p className="text-muted-foreground mb-6">
                  Create your first activity to start tracking your tube journeys
                </p>
                <Button onClick={() => setShowActivityModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Activity
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activities.map((activity: any) => {
                const unifiedState = activity._unifiedState || { visited_actual: 0, planned_total: 0 };
                const { visited_actual, planned_total } = unifiedState;
                const statusText = activity.status === 'draft' ? 'Not started' : 
                                 activity.status === 'active' ? 'Active' : 
                                 activity.status === 'paused' ? 'Paused' : 'Completed';
                
                return (
                  <Card key={activity.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{activity.title || "Untitled Activity"}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={activity.status === 'completed' ? 'default' : 
                                           activity.status === 'active' ? 'secondary' : 
                                           activity.status === 'paused' ? 'outline' : 'outline'}>
                            {statusText}
                          </Badge>
                          <Badge variant="outline">
                            Visited {visited_actual}/{planned_total}
                          </Badge>
                        </div>
                      </CardTitle>
                      <CardDescription>
                        {activity.start_station_tfl_id && activity.end_station_tfl_id && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4" />
                            <span>
                              {getStationName(activity.start_station_tfl_id)} → {getStationName(activity.end_station_tfl_id)}
                            </span>
                          </div>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ActivityTileMiniMap 
                        activityId={activity.id}
                        updatedAt={activity.updated_at}
                      />
                      <div className="space-y-3 mt-4">
                        {!activity.start_station_tfl_id && !activity.end_station_tfl_id && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>No route defined</span>
                          </div>
                        )}
                        {!!activity.distance_km && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{Number(activity.distance_km).toFixed(1)} km</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {activity.status === 'active' ? 'Updated' : 'Created'} {new Date(activity.started_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                         onClick={() => {
                            console.log(`🧭 NAV: View activity clicked: ${activity.id}`);
                            navigate(`/activities/${activity.id}`);
                          }}
                          className="flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log(`🧭 NAV: Edit activity clicked: ${activity.id}`);
                            navigate(`/activities/${activity.id}/edit`);
                          }}
                          className="flex items-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            console.log(`🧭 NAV: Start/Resume activity clicked: ${activity.id}, status: ${activity.status}`);
                            handleStartOrResumeActivity(activity.id, activity.status);
                          }}
                          className="flex items-center gap-1"
                          disabled={activity.status !== 'active' && activities.some((a: any) => a.status === 'active' && a.id !== activity.id)}
                        >
                          <Play className="w-4 h-4" />
                          {activity.status === 'draft' ? 'Start' : 
                           activity.status === 'active' ? 'Continue' : 'Resume'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteModal({ 
                            open: true, 
                            activityId: activity.id, 
                            title: activity.title || "Untitled Activity" 
                          })}
                          className="flex items-center gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </AppLayout>
      
      <ActivityStartModal 
        open={showActivityModal} 
        onOpenChange={setShowActivityModal} 
      />
      
      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal(prev => ({ ...prev, open }))}
        title="Delete this Activity?"
        description="This action can't be undone. You'll lose this activity and its local progress."
        onConfirm={handleDeleteActivity}
        isDeleting={isDeleting}
      />
    </>
  );
};

export default Activities;