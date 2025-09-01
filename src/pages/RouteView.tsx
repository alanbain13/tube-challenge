import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/useStations';
import { supabase } from '@/integrations/supabase/client';
import RouteMap from '@/components/RouteMap';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeft } from 'lucide-react';

interface Route {
  id: string;
  name: string;
  description?: string;
  start_station_tfl_id: string;
  end_station_tfl_id: string;
  estimated_duration_minutes?: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const RouteView = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const { stations } = useStations();
  const { user } = useAuth();

  console.log('🧭 NAV: RouteView mounted for route:', routeId);

  useEffect(() => {
    if (routeId) {
      loadRouteData(routeId);
    }
  }, [routeId]);

  const loadRouteData = async (routeId: string) => {
    console.log('📦 DATA: Loading route view data for ID:', routeId);
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();

      if (error) {
        console.error('Error fetching route:', error);
        navigate('/routes');
        return;
      }

      const routeData = data as Route;
      console.log('📦 DATA: Route loaded:', { name: routeData.name, stationCount: 'loading...' });
      setRoute(routeData);
      
      // Load route stations
      const { data: routeStations } = await supabase
        .from('route_stations')
        .select('station_tfl_id')
        .eq('route_id', routeId)
        .order('sequence_number');
      
      if (routeStations) {
        const stationIds = routeStations.map(rs => rs.station_tfl_id);
        console.log('📦 DATA: Route stations loaded:', stationIds.length);
        setSelectedStations(stationIds);
      }
    } catch (error) {
      console.error('Error loading route data:', error);
      navigate('/routes');
    } finally {
      setLoading(false);
    }
  };

  const getStationName = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    return station ? station.name : stationId;
  };

  // SEO
  useEffect(() => {
    document.title = `${route?.name || 'Route'} | Tube Challenge`;
  }, [route]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading route...</p>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Route not found</h2>
          <Button onClick={() => navigate('/routes')}>
            Back to Routes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate('/routes')}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{route.name}</h1>
                <p className="text-muted-foreground">Route Details (Read-Only)</p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Route Info */}
            <Card>
              <CardHeader>
                <CardTitle>Route Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Route Name</label>
                  <p className="text-lg font-medium">{route.name}</p>
                </div>

                {route.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p>{route.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Start Station</label>
                    <p className="font-medium">{getStationName(route.start_station_tfl_id)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">End Station</label>
                    <p className="font-medium">{getStationName(route.end_station_tfl_id)}</p>
                  </div>
                </div>

                {route.estimated_duration_minutes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Estimated Duration</label>
                    <p className="font-medium">{route.estimated_duration_minutes} minutes</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Public Route</label>
                  <p className="font-medium">{route.is_public ? 'Yes' : 'No'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">{new Date(route.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Route Map and Summary */}
            <div className="space-y-6">
              <RouteMap
                selectedStations={selectedStations}
                onStationSelect={() => {}}
                onStationRemove={() => {}}
                onSequenceChange={() => {}}
                readOnly={true}
                // Don't pass activityMode - undefined means route creation/view mode
              />

              {/* Route Summary */}
              {selectedStations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Route Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Stations:</span>
                        <span className="font-medium">{selectedStations.length}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Route: </span>
                        <span className="font-medium">
                          {selectedStations.map(getStationName).join(' → ')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteView;