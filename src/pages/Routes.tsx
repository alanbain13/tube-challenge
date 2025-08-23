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
    console.log(`🔍 Looking for station ${tflId}, found:`, station?.name || 'NOT FOUND');
    return station ? station.name : tflId;
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
          station_tfl_ids: orderedStations
        })
        .select()
        .single();

      if (error) throw error;

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
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
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
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Dashboard
            </Button>
          </div>
        </header>

        <main>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-lg text-muted-foreground">Loading routes...</p>
            </div>
          ) : routes.length === 0 ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <h2 className="text-xl font-semibold mb-4">No routes yet</h2>
                <p className="text-muted-foreground mb-6">
                  Create your first route to start planning your tube adventures
                </p>
                <Button onClick={() => navigate("/routes/create")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Route
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {routes.map((route: any) => (
                <Card key={route.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{route.name}</span>
                      <Badge variant="outline">
                        {route.route_stations?.length || 0} stations
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {route.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                       <div className="flex items-center gap-2 text-sm text-muted-foreground">
                         <MapPin className="w-4 h-4" />
                         <span>
                           {getStationName(route.start_station_tfl_id)} → {getStationName(route.end_station_tfl_id)}
                         </span>
                       </div>
                      {route.estimated_duration_minutes && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{route.estimated_duration_minutes} minutes</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Created {new Date(route.created_at).toLocaleDateString()}
                      </div>
                    </div>
                     <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/routes/${route.id}/view`)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
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
                          onClick={() => createRouteActivity(route)}
                          className="flex items-center gap-1"
                        >
                          <Play className="w-4 h-4" />
                          Start Activity
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
                        </Button>
                      </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
        
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
      </div>
    </div>
  );
};

export default Routes;