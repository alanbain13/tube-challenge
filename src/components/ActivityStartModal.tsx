import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Route, Camera, Navigation } from 'lucide-react';
import { useStations, Station } from '@/hooks/useStations';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import RouteMap from '@/components/RouteMap';
import SearchStationInput from '@/components/SearchStationInput';

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
  const { stations, loading: stationsLoading } = useStations();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [activeTab, setActiveTab] = useState('manual');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStartStation, setSelectedStartStation] = useState<Station | null>(null);
  const [selectedEndStation, setSelectedEndStation] = useState<Station | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [mapStations, setMapStations] = useState<Station[]>([]);

  // GPS state
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

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
      setSelectedStartStation(null);
      setSelectedEndStation(null);
      setSelectedRoute(null);
      setMapStations([]);
      setLocation(null);
    }
  }, [open]);

  const getStationName = (tflId: string) => {
    const station = stations.find(s => s.id === tflId);
    return station ? station.name : tflId;
  };

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });
      
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      
      toast({
        title: "Location found",
        description: "Ready to check in at your current location"
      });
    } catch (error) {
      toast({
        title: "Location error",
        description: "Could not get your current location",
        variant: "destructive"
      });
    } finally {
      setLocationLoading(false);
    }
  };

  const createActivity = async (data: {
    title: string;
    description?: string;
    start_station_tfl_id?: string;
    end_station_tfl_id?: string;
    route_id?: string;
    status: 'draft' | 'active';
    start_latitude?: number;
    start_longitude?: number;
  }) => {
    if (!user) return null;

    // If creating from route, we need to clone the route stations
    let station_tfl_ids: string[] = [];
    
    if (data.route_id) {
      // Fetch route stations in sequence order
      const { data: routeStations, error: routeError } = await supabase
        .from('route_stations')
        .select('station_tfl_id')
        .eq('route_id', data.route_id)
        .order('sequence_number');
      
      if (routeError) throw routeError;
      
      if (routeStations && routeStations.length > 0) {
        station_tfl_ids = routeStations.map(rs => rs.station_tfl_id);
        console.log(`CloneRoute: activity_id=pending stations_copied=${station_tfl_ids.length} order_preserved=true`);
      }
    } else if (data.start_station_tfl_id) {
      // Manual activity with start/end stations
      station_tfl_ids = [data.start_station_tfl_id, data.end_station_tfl_id].filter(Boolean);
    } else {
      // Quick check-in activity with no predefined stations
      station_tfl_ids = [];
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
        start_latitude: data.start_latitude,
        start_longitude: data.start_longitude,
        station_tfl_ids: station_tfl_ids
      })
      .select()
      .single();

    if (error) throw error;
    
    if (data.route_id && station_tfl_ids.length > 0) {
      console.log(`CloneRoute: activity_id=${activity.id} stations_copied=${station_tfl_ids.length} order_preserved=true`);
    }
    
    return activity;
  };

  const handleManualCreate = async () => {
    if (!selectedStartStation) {
      toast({
        title: "Start station required",
        description: "Please select a start station",
        variant: "destructive"
      });
      return;
    }

    try {
      const activity = await createActivity({
        title: title || `${selectedStartStation.name} to ${selectedEndStation?.name || 'Unknown'}`,
        description,
        start_station_tfl_id: selectedStartStation.id,
        end_station_tfl_id: selectedEndStation?.id,
        status: 'draft'
      });

      toast({
        title: "Activity created",
        description: "Check in at your start station to begin"
      });

      console.log(`🧭 NAV: Navigating to activity detail: ${activity.id}`);
      onOpenChange(false);
      navigate(`/activities/${activity.id}`);
    } catch (error) {
      toast({
        title: "Error creating activity",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleQuickCheckin = async () => {
    if (!location) {
      toast({
        title: "Location required",
        description: "Please get your current location first",
        variant: "destructive"
      });
      return;
    }

    try {
      const activity = await createActivity({
        title: title || `Activity at ${new Date().toLocaleTimeString()}`,
        description,
        status: 'active',
        start_latitude: location.latitude,
        start_longitude: location.longitude
      });

      toast({
        title: "Activity started",
        description: "You're checked in and ready to go!"
      });

      console.log(`🧭 NAV: Navigating to activity checkin: ${activity.id}`);
      onOpenChange(false);
      navigate(`/activities/${activity.id}/checkin`);
    } catch (error) {
      toast({
        title: "Error starting activity",
        description: "Please try again",
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
        description: "Check in at the start station to begin"
      });

      console.log(`🧭 NAV: Navigating to activity detail: ${activity.id}`);
      onOpenChange(false);
      navigate(`/activities/${activity.id}`);
    } catch (error) {
      toast({
        title: "Error creating route activity",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleMapStationSelect = (station: Station) => {
    setMapStations(prev => {
      const existing = prev.find(s => s.id === station.id);
      if (existing) {
        return prev.filter(s => s.id !== station.id);
      }
      return [...prev, station];
    });
  };

  const handleSearchStationSelect = (station: Station, type: 'start' | 'end') => {
    if (type === 'start') {
      setSelectedStartStation(station);
    } else {
      setSelectedEndStation(station);
    }
    // Auto-add to map selection for visual confirmation
    setMapStations(prev => {
      const existing = prev.find(s => s.id === station.id);
      if (!existing) {
        return [...prev, station];
      }
      return prev;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Activity</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="checkin" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Check-in
            </TabsTrigger>
            <TabsTrigger value="route" className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              From Route
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Activity Title (Optional)</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My tube journey"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Journey notes..."
                    rows={3}
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Start Station</Label>
                    <SearchStationInput
                      stations={stations}
                      onStationSelect={(station) => handleSearchStationSelect(station, 'start')}
                      placeholder="Search start station..."
                      selectedStation={selectedStartStation}
                    />
                  </div>

                  <div>
                    <Label>End Station (Optional)</Label>
                    <SearchStationInput
                      stations={stations}
                      onStationSelect={(station) => handleSearchStationSelect(station, 'end')}
                      placeholder="Search end station..."
                      selectedStation={selectedEndStation}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleManualCreate} 
                  className="w-full"
                  disabled={!selectedStartStation}
                >
                  Create Activity
                </Button>
              </div>

              <div className="h-96">
                {!stationsLoading && (
                  <RouteMap
                    selectedStations={mapStations.map(s => s.id)}
                    onStationSelect={(stationId) => {
                      const station = stations.find(s => s.id === stationId);
                      if (station) handleMapStationSelect(station);
                    }}
                    onStationRemove={(stationId) => 
                      setMapStations(prev => prev.filter(s => s.id !== stationId))
                    }
                    onSequenceChange={() => {}} // Not needed for activity creation
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="checkin" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5" />
                  Check-in at Current Location
                </CardTitle>
                <CardDescription>
                  Start an activity immediately by checking in at your current location
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="checkin-title">Activity Title (Optional)</Label>
                  <Input
                    id="checkin-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Quick activity"
                  />
                </div>

                <div>
                  <Label htmlFor="checkin-description">Description (Optional)</Label>
                  <Textarea
                    id="checkin-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Activity notes..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    variant="outline"
                    className="flex-1"
                  >
                    {locationLoading ? "Getting location..." : "Get Location"}
                  </Button>
                  
                  <Button 
                    onClick={handleQuickCheckin}
                    disabled={!location}
                    className="flex-1"
                  >
                    Start Activity
                  </Button>
                </div>

                {location && (
                  <div className="text-sm text-muted-foreground">
                    Location found: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="route" className="space-y-6">
            <div>
              <Label htmlFor="route-title">Activity Title (Optional)</Label>
              <Input
                id="route-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Route challenge"
              />
            </div>

            <div>
              <Label htmlFor="route-description">Description (Optional)</Label>
              <Textarea
                id="route-description"
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