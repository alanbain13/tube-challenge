import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Route } from 'lucide-react';
import { useStations, Station } from '@/hooks/useStations';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

interface ActivityStartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Route {
  id: string;
  name: string;
  description?: string;
  start_station_tfl_id: string;
  end_station_tfl_id: string;
  estimated_duration_minutes?: number;
}

const ActivityStartModal: React.FC<ActivityStartModalProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { stations } = useStations();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [activeTab, setActiveTab] = useState('unplanned');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  // Fetch user routes
  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ['routes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && open
  });

  useEffect(() => {
    if (open) {
      // Reset form when modal opens
      setTitle('');
      setDescription('');
      setSelectedRoute(null);
    }
  }, [open]);

  const getStationName = (tflId: string) => {
    const station = stations.find(s => s.id === tflId);
    return station ? station.displayName : tflId;
  };

  const createActivity = async (data: {
    title: string;
    description?: string;
    start_station_tfl_id?: string;
    end_station_tfl_id?: string;
    route_id?: string;
    status: 'draft' | 'active';
  }) => {
    if (!user) return null;

    // If creating from route, we need to clone the route stations with names
    let station_tfl_ids: string[] = [];
    
    if (data.route_id) {
      // Fetch route stations in sequence order
      const { data: routeStations, error: routeError } = await supabase
        .from('route_stations')
        .select(`
          station_tfl_id,
          sequence_number
        `)
        .eq('route_id', data.route_id)
        .order('sequence_number');
      
      if (routeError) throw routeError;
      
      if (routeStations && routeStations.length > 0) {
        station_tfl_ids = routeStations.map(rs => rs.station_tfl_id);
        console.log(`Route clone: ${station_tfl_ids.length} stations from route ${data.route_id}`);
      } else {
        console.warn(`Route ${data.route_id} has no stations - creating empty activity`);
      }
    } else {
      // Unplanned activity - empty plan initially, will be populated on first check-in
      station_tfl_ids = [];
      console.log(`Unplanned activity: empty initial plan`);
    }

    // Ensure we have valid station IDs by checking against stations table
    if (station_tfl_ids.length > 0) {
      const { data: validStations, error: stationError } = await supabase
        .from('stations')
        .select('tfl_id, name')
        .in('tfl_id', station_tfl_ids);
      
      if (stationError) throw stationError;
      
      const validTflIds = validStations?.map(s => s.tfl_id) || [];
      const invalidIds = station_tfl_ids.filter(id => !validTflIds.includes(id));
      
      if (invalidIds.length > 0) {
        console.warn(`Invalid station IDs removed: ${invalidIds.join(', ')}`);
        station_tfl_ids = station_tfl_ids.filter(id => validTflIds.includes(id));
      }
      
      // Block creation if no valid stations remain for route activities
      if (data.route_id && station_tfl_ids.length === 0) {
        throw new Error("This route has no valid stations. Please edit the route and try again.");
      }
    }

    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        user_id: user.id,
        title: data.title,
        notes: data.description,
        start_station_tfl_id: data.start_station_tfl_id,
        end_station_tfl_id: data.end_station_tfl_id,
        route_id: data.route_id,
        status: data.status,
        station_tfl_ids: station_tfl_ids
      })
      .select()
      .single();

    if (error) throw error;
    
    // Telemetry logging
    if (data.route_id) {
      console.log(`CloneRoute: activity_id=${activity.id} stations_copied=${station_tfl_ids.length} order_preserved=true`);
    }
    
    console.info("ActivityCreated", {id: activity.id, plan_size: station_tfl_ids.length});
    return activity;
  };

  const handleUnplannedCreate = async () => {
    try {
      const activity = await createActivity({
        title: title || `Unplanned Activity - ${new Date().toLocaleDateString()}`,
        description,
        status: 'draft' // Start as draft, will become active on first check-in
      });

      toast({
        title: "Activity created",
        description: "Check in at any station to begin your journey"
      });

      console.log(`🧭 NAV: Navigating to activity checkin: ${activity.id}`);
      onOpenChange(false);
      navigate(`/activities/${activity.id}/checkin`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast({
        title: "Error creating activity",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleRouteStart = async () => {
    if (!selectedRoute) {
      toast({
        title: "Route required",
        description: "Please select a route",
        variant: "destructive"
      });
      return;
    }

    try {
      const activity = await createActivity({
        title: title || `${selectedRoute.name} Challenge`,
        description: description || selectedRoute.description,
        route_id: selectedRoute.id,
        start_station_tfl_id: selectedRoute.start_station_tfl_id,
        end_station_tfl_id: selectedRoute.end_station_tfl_id,
        status: 'draft'
      });

      toast({
        title: "Route activity created",
        description: "Check in at any station to begin your journey"
      });

      console.log(`🧭 NAV: Navigating to activity checkin: ${activity.id}`);
      onOpenChange(false);
      navigate(`/activities/${activity.id}/checkin`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast({
        title: "Error creating route activity",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Activity</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="unplanned" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Unplanned
            </TabsTrigger>
            <TabsTrigger value="planned" className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Planned
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unplanned" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Start Unplanned Activity
                </CardTitle>
                <CardDescription>
                  Begin with your first check-in at any station. Activity starts on the first successful photo verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="unplanned-title">Activity Title (Optional)</Label>
                  <Input
                    id="unplanned-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My spontaneous journey"
                  />
                </div>

                <div>
                  <Label htmlFor="unplanned-description">Description (Optional)</Label>
                  <Textarea
                    id="unplanned-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Activity notes..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleUnplannedCreate} 
                  className="w-full"
                >
                  Create Unplanned Activity
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="planned" className="space-y-6">
            <div>
              <Label htmlFor="planned-title">Activity Title (Optional)</Label>
              <Input
                id="planned-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Route challenge"
              />
            </div>

            <div>
              <Label htmlFor="planned-description">Description (Optional)</Label>
              <Textarea
                id="planned-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Challenge notes..."
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <Label>Select Route</Label>
              {routesLoading ? (
                <div>Loading routes...</div>
              ) : routes.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No saved routes found.</p>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/routes/create')}
                      className="mt-2"
                    >
                      Create a Route
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 max-h-64 overflow-y-auto">
                  {routes.map((route) => (
                    <Card 
                      key={route.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedRoute?.id === route.id 
                          ? 'ring-2 ring-primary' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedRoute(route)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{route.name}</h4>
                            {route.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {route.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>{getStationName(route.start_station_tfl_id)} → {getStationName(route.end_station_tfl_id)}</span>
                              {route.estimated_duration_minutes && (
                                <span>{route.estimated_duration_minutes} min</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Button 
              onClick={handleRouteStart} 
              className="w-full"
              disabled={!selectedRoute}
            >
              Start Route Activity
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityStartModal;