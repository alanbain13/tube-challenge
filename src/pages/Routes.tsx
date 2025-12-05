import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Clock, Play, Edit, Trash2, Share2, Lock, Users, Train, Trophy, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ActivityStartModal from "@/components/ActivityStartModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { MiniMapSnapshot } from "@/components/MiniMapSnapshot";
import { AppLayout } from "@/components/AppLayout";
import { ShareAsChallengeModal } from "@/components/ShareAsChallengeModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RouteWithStations {
  id: string;
  name: string;
  description: string | null;
  start_station_tfl_id: string;
  end_station_tfl_id: string;
  estimated_duration_minutes: number | null;
  is_public: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  route_stations: { station_tfl_id: string; sequence_number: number }[];
  // For shared routes
  profiles?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  // Check if a challenge exists for this route
  challenges?: { id: string }[];
}

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
  const [challengeModal, setChallengeModal] = useState<{ open: boolean; route: RouteWithStations | null }>({
    open: false,
    route: null
  });

  // Helper function to get station name by TfL ID
  const getStationName = (tflId: string) => {
    const station = stations.find(s => s.id === tflId);
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

  // Fetch user's own routes
  const { data: myRoutes = [], isLoading: isLoadingMyRoutes, refetch: refetchMyRoutes } = useQuery({
    queryKey: ["my-routes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          route_stations(station_tfl_id, sequence_number),
          challenges(id)
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RouteWithStations[];
    },
    enabled: !!user,
  });

  // Fetch friends list first
  const { data: friendsList = [] } = useQuery({
    queryKey: ["friends-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id_1, user_id_2")
        .eq("status", "accepted")
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
      if (error) throw error;
      return data.map(f => f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1);
    },
    enabled: !!user,
  });

  // Fetch shared routes from friends
  const { data: sharedRoutes = [], isLoading: isLoadingShared, refetch: refetchShared } = useQuery({
    queryKey: ["shared-routes", friendsList],
    queryFn: async () => {
      if (friendsList.length === 0) return [];
      
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          route_stations(station_tfl_id, sequence_number),
          challenges(id),
          profiles!routes_user_id_fkey(display_name, username, avatar_url)
        `)
        .eq("is_public", true)
        .in("user_id", friendsList)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as RouteWithStations[];
    },
    enabled: friendsList.length > 0,
  });

  const refetch = () => {
    refetchMyRoutes();
    refetchShared();
  };

  // Determine route difficulty based on station count
  const getDifficulty = (stationCount: number): { label: string; variant: "default" | "secondary" | "destructive" } => {
    if (stationCount <= 5) return { label: "Easy", variant: "default" };
    if (stationCount <= 15) return { label: "Medium", variant: "secondary" };
    return { label: "Hard", variant: "destructive" };
  };

  const handleToggleShare = async (routeId: string, currentPublicStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("routes")
        .update({ is_public: !currentPublicStatus })
        .eq("id", routeId);

      if (error) throw error;

      if (!currentPublicStatus) {
        toast({
          title: "Route shared",
          description: "Friends can now see this route"
        });
      } else {
        toast({
          title: "Route made private",
          description: "Only you can see this route now"
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

  const createRouteActivity = async (route: RouteWithStations) => {
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
          station_tfl_ids: orderedStations
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

  const getCreatorName = (route: RouteWithStations) => {
    return route.profiles?.display_name || route.profiles?.username || "Friend";
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  const renderRouteCard = (route: RouteWithStations, isOwned: boolean) => {
    const stationSequence = route.route_stations
      ?.sort((a, b) => a.sequence_number - b.sequence_number)
      .map(rs => rs.station_tfl_id) || [];
    const stationCount = route.route_stations?.length || 0;
    const difficulty = getDifficulty(stationCount);
    const hasChallenge = route.challenges && route.challenges.length > 0;
    
    return (
      <Card key={route.id} className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={difficulty.variant}>{difficulty.label}</Badge>
              {isOwned && (
                <Badge variant={route.is_public ? "default" : "outline"} className="text-xs">
                  {route.is_public ? (
                    <>
                      <Users className="w-3 h-3 mr-1" />
                      Shared
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 mr-1" />
                      Private
                    </>
                  )}
                </Badge>
              )}
              {hasChallenge && (
                <Badge variant="secondary" className="text-xs">
                  <Trophy className="w-3 h-3 mr-1" />
                  Challenge
                </Badge>
              )}
            </div>
          </div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Train className="w-4 h-4 text-muted-foreground" />
            <span className="line-clamp-1">{route.name}</span>
          </CardTitle>
          {!isOwned && route.profiles && (
            <div className="flex items-center gap-2 mt-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={route.profiles.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{getCreatorName(route).charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">by {getCreatorName(route)}</span>
            </div>
          )}
          <CardDescription className="line-clamp-2 text-sm">
            {route.description || "No description"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <MiniMapSnapshot
            type="route"
            id={route.id}
            stationSequence={stationSequence}
            updatedAt={route.updated_at}
          />
          <div className="space-y-2 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="font-normal text-xs">
                <MapPin className="w-3 h-3 mr-1" />
                {stationCount} stations
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {getStationName(route.start_station_tfl_id)} → {getStationName(route.end_station_tfl_id)}
              </span>
            </div>
            {!!route.estimated_duration_minutes && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{route.estimated_duration_minutes} minutes</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button
              size="sm"
              onClick={() => createRouteActivity(route)}
              className="flex items-center gap-1 text-xs"
            >
              <Play className="w-3 h-3" />
              Start Route
            </Button>
            
            {isOwned ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/routes/${route.id}/edit`)}
                  className="flex items-center gap-1 text-xs"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </Button>
                {!hasChallenge && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setChallengeModal({ open: true, route })}
                    className="flex items-center gap-1 text-xs"
                  >
                    <Trophy className="w-3 h-3" />
                    Create Challenge
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleShare(route.id, route.is_public)}
                  className="flex items-center gap-1 text-xs"
                >
                  {route.is_public ? <Lock className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                  {route.is_public ? "Make Private" : "Share"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteModal({ 
                    open: true, 
                    routeId: route.id, 
                    title: route.name 
                  })}
                  className="flex items-center gap-1 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/routes/${route.id}/view`)}
                className="flex items-center gap-1 text-xs"
              >
                <Eye className="w-3 h-3" />
                View Details
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <AppLayout>
        <header className="mb-6 text-center">
          <div>
            <h1 className="text-4xl font-black text-foreground mb-2">Routes</h1>
            <p className="text-muted-foreground">Your saved routes and routes shared by friends</p>
          </div>
          <div className="flex gap-2 justify-center mt-6">
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
          <Tabs defaultValue="my-routes" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
              <TabsTrigger value="my-routes">My Routes</TabsTrigger>
              <TabsTrigger value="shared">
                Shared With Me
                {sharedRoutes.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{sharedRoutes.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-routes">
              {isLoadingMyRoutes ? (
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
                  {myRoutes.map(route => renderRouteCard(route, true))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="shared">
              {isLoadingShared ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-lg text-muted-foreground">Loading shared routes...</p>
                </div>
              ) : sharedRoutes.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No shared routes yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Routes shared by your friends will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sharedRoutes.map(route => renderRouteCard(route, false))}
                </div>
              )}
            </TabsContent>
          </Tabs>
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

      <ShareAsChallengeModal
        open={challengeModal.open}
        onOpenChange={(open) => setChallengeModal(prev => ({ ...prev, open }))}
        route={challengeModal.route}
        onSuccess={refetch}
      />
    </>
  );
};

export default Routes;
