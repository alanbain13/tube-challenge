import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Clock, Play, Eye, Edit, Trash2, Share2, Lock, Globe, Train } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ActivityStartModal from "@/components/ActivityStartModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { MiniMapSnapshot } from "@/components/MiniMapSnapshot";
import { AppLayout } from "@/components/AppLayout";

const Routes = () => {
  const { user, loading } = useAuth();
  const { stations } = useStations();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; routeId: string; title: string }>({
    open: false,
    routeId: "",
    title: ""
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper function to get station name by TfL ID
  const getStationName = (tflId: string) => {
    const station = stations.find(s => s.id === tflId);
    console.log(`🔍 Looking for station ${tflId}, found:`, station?.displayName || 'NOT FOUND');
    return station ? station.displayName : tflId;
  };

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // SEO
  useEffect(() => {
    document.title = "Routes | Tube Challenge";
    const desc = "View and manage your saved tube routes and challenges.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  // Fetch user's routes
  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          route_stations(station_tfl_id, sequence_number)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Determine route difficulty based on station count
  const getDifficulty = (stationCount: number): { label: string; variant: "default" | "secondary" | "destructive" } => {
    if (stationCount <= 5) return { label: "Easy", variant: "default" };
    if (stationCount <= 15) return { label: "Medium", variant: "secondary" };
    return { label: "Hard", variant: "destructive" };
  };

  const handleTogglePublish = async (routeId: string, currentPublicStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("routes")
        .update({ is_public: !currentPublicStatus })
        .eq("id", routeId);

      if (error) throw error;

      if (!currentPublicStatus) {
        // Copy share link when publishing
        const shareUrl = `${window.location.origin}/routes/${routeId}/view`;
        await navigator.clipboard.writeText(shareUrl);
        
        toast({
          title: "Route published",
          description: "Share link copied to clipboard!"
        });
      } else {
        toast({
          title: "Route made private",
          description: "Your route is now private"
        });
      }

      refetch();
    } catch (error) {
      toast({
        title: "Error updating route",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleDeleteRoute = async () => {
    if (!deleteModal.routeId) return;
    
    setIsDeleting(true);
    try {
      // First delete related route stations
      const { error: stationsError } = await supabase
        .from("route_stations")
        .delete()
        .eq("route_id", deleteModal.routeId);
      
      if (stationsError) throw stationsError;

      // Then delete the route
      const { error } = await supabase
        .from("routes")
        .delete()
        .eq("id", deleteModal.routeId);

      if (error) throw error;

      toast({
        title: "Route deleted",
        description: "The route has been removed"
      });

      setDeleteModal({ open: false, routeId: "", title: "" });
      refetch();
    } catch (error) {
      toast({
        title: "Error deleting route",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const createRouteActivity = async (route: any) => {
    if (!user) return;

    try {
      // Get full route stations in sequence order
      const { data: routeStations, error: routeError } = await supabase
        .from('route_stations')
        .select('station_tfl_id, sequence_number')
        .eq('route_id', route.id)
        .order('sequence_number', { ascending: true });

      if (routeError) throw routeError;

      // Build ordered station list from route
      const orderedStations = routeStations?.map(rs => rs.station_tfl_id) || [route.start_station_tfl_id, route.end_station_tfl_id];
      
      console.log('CloneRoute: activity_id=pending stations_copied=' + orderedStations.length + ' order_preserved=true');

      // Create the activity first
      const { data: activity, error } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          title: `${route.name} Challenge`,
          notes: route.description,
          route_id: route.id,
          start_station_tfl_id: orderedStations[0] || route.start_station_tfl_id,
          end_station_tfl_id: orderedStations[orderedStations.length - 1] || route.end_station_tfl_id,
          status: 'draft',
          station_tfl_ids: orderedStations // Keep for backwards compatibility
        })
        .select()
        .single();

      if (error) throw error;

      // Create activity_plan_item records with seq_planned preserved
      if (orderedStations.length > 0) {
        const planItems = orderedStations.map((stationId, index) => ({
          activity_id: activity.id,
          station_tfl_id: stationId,
          seq_planned: index + 1
        }));

        const { error: planError } = await supabase
          .from('activity_plan_item')
          .insert(planItems);

        if (planError) throw planError;
      }

      console.log('CloneRoute: activity_id=' + activity.id + ' stations_copied=' + orderedStations.length + ' order_preserved=true');

      toast({
        title: "Route activity created",
        description: `${orderedStations.length} stations added in sequence`
      });

      navigate(`/activities/${activity.id}/checkin`);
    } catch (error) {
      console.error('Error creating route activity:', error);
      toast({
        title: "Error creating activity",
        description: "Please try again",
        variant: "destructive"
      });
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
          <h1 className="text-3xl font-bold text-foreground">Routes</h1>
          <p className="text-muted-foreground">Your saved tube routes and challenges</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowActivityModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Start Activity
          </Button>
          <Button variant="outline" onClick={() => navigate("/routes/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Route
          </Button>
        </div>
      </header>

        <main>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-lg text-muted-foreground">Loading routes...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* CTA Card to create new route */}
              <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/routes/create")}>
                <CardContent className="flex flex-col items-center justify-center h-full min-h-[280px] text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Plus className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Create a New Route</h3>
                  <p className="text-sm text-muted-foreground">
                    Plan your next tube adventure and share it with friends
                  </p>
                </CardContent>
              </Card>
              {routes.map((route: any) => {
                const stationSequence = route.route_stations
                  ?.sort((a: any, b: any) => a.sequence_number - b.sequence_number)
                  .map((rs: any) => rs.station_tfl_id) || [];
                const stationCount = route.route_stations?.length || 0;
                const difficulty = getDifficulty(stationCount);
                
                return (
                  <Card key={route.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={difficulty.variant}>{difficulty.label}</Badge>
                          <Badge variant={route.is_public ? "default" : "outline"}>
                            {route.is_public ? (
                              <>
                                <Globe className="w-3 h-3 mr-1" />
                                Published
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3 mr-1" />
                                Private
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                      <CardTitle className="flex items-center gap-2">
                        <Train className="w-5 h-5 text-primary" />
                        <span className="line-clamp-1">{route.name}</span>
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {route.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MiniMapSnapshot
                        type="route"
                        id={route.id}
                        stationSequence={stationSequence}
                        updatedAt={route.updated_at}
                      />
                      <div className="space-y-3 mt-4">
                       <div className="flex items-center gap-2 text-sm">
                         <Badge variant="outline" className="font-normal">
                           <MapPin className="w-3 h-3 mr-1" />
                           {stationCount} stations
                         </Badge>
                       </div>
                       <div className="flex items-center gap-2 text-sm text-muted-foreground">
                         <span className="truncate">
                           {getStationName(route.start_station_tfl_id)} → {getStationName(route.end_station_tfl_id)}
                         </span>
                       </div>
                      {!!route.estimated_duration_minutes && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{route.estimated_duration_minutes} minutes</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Created {new Date(route.created_at).toLocaleDateString()}
                      </div>
                    </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => createRouteActivity(route)}
                          className="flex items-center gap-1"
                        >
                          <Play className="w-4 h-4" />
                          Start Route
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/routes/${route.id}/edit`)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTogglePublish(route.id, route.is_public)}
                          className="flex items-center gap-1"
                        >
                          <Share2 className="w-4 h-4" />
                          {route.is_public ? "Unpublish" : "Share"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteModal({ 
                            open: true, 
                            routeId: route.id, 
                            title: route.name 
                          })}
                          className="flex items-center gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
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
        title="Delete this Route?"
        description="This action can't be undone. You'll lose this route and its local progress."
        onConfirm={handleDeleteRoute}
        isDeleting={isDeleting}
      />
    </>
  );
};

export default Routes;