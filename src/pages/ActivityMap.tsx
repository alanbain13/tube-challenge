import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/useStations';
import { supabase } from '@/integrations/supabase/client';
import RouteMap from '@/components/RouteMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeft } from 'lucide-react';

interface Activity {
  id: string;
  title?: string;
  start_station_tfl_id?: string;
  end_station_tfl_id?: string;
  station_tfl_ids: string[];
  user_id: string;
  status: string;
  created_at: string;
}

interface StationVisit {
  station_tfl_id: string;
  status: 'pending' | 'visited' | 'failed';
  sequence_number: number;
}

const ActivityMap = () => {
  const navigate = useNavigate();
  const { id: activityId } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const { stations } = useStations();
  const { user } = useAuth();

  console.log('🧭 NAV: ActivityMap mounted for activity:', activityId);
  console.log('🗺️ MAP: Activity map init with readOnly=true');

  useEffect(() => {
    if (activityId) {
      loadActivityData(activityId);
    }
  }, [activityId]);

  const loadActivityData = async (activityId: string) => {
    console.log('📦 DATA: Loading activity map data for ID:', activityId);
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          station_visits(
            station_tfl_id,
            status,
            sequence_number
          )
        `)
        .eq('id', activityId)
        .single();

      if (error) {
        console.error('Error fetching activity:', error);
        navigate('/activities');
        return;
      }

      const activityData = data as Activity & { station_visits: StationVisit[] };
      console.log('📦 DATA: Activity map data loaded:', { 
        title: activityData.title, 
        stationCount: activityData.station_tfl_ids?.length || 0,
        startStation: activityData.start_station_tfl_id,
        endStation: activityData.end_station_tfl_id,
        visitsCount: activityData.station_visits?.length || 0
      });
      setActivity(activityData);
      setVisits(activityData.station_visits || []);
      
      // Set selected stations for map display
      if (activityData.station_tfl_ids) {
        setSelectedStations(activityData.station_tfl_ids);
      }
    } catch (error) {
      console.error('Error loading activity data:', error);
      navigate('/activities');
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
    document.title = `${activity?.title || 'Activity'} Map | Tube Challenge`;
  }, [activity]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading activity map...</p>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Activity not found</h2>
          <Button onClick={() => navigate('/activities')}>
            Back to Activities
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate(`/activities/${activity.id}`)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{activity.title || 'Activity Map'}</h1>
                <p className="text-muted-foreground">Interactive route visualization</p>
              </div>
            </div>
          </header>

          <div className="space-y-6">
            {/* Activity Context Info */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">Start Station</div>
                    <div className="font-medium">
                      {activity.start_station_tfl_id ? 
                        getStationName(activity.start_station_tfl_id) : 
                        'Not set'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">End Station</div>
                    <div className="font-medium">
                      {activity.end_station_tfl_id ? 
                        getStationName(activity.end_station_tfl_id) : 
                        'Not set'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Stations</div>
                    <div className="font-medium">{selectedStations.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Read-only Activity Map */}
            <RouteMap
              selectedStations={selectedStations}
              onStationSelect={() => {}}
              onStationRemove={() => {}}
              onSequenceChange={() => {}}
              readOnly={true}
              activityStations={activity.station_tfl_ids}
              visits={visits}
            />

            {/* Map Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Map Legend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-white border-2 border-blue-500 rounded-full"></div>
                    <span>Not Visited</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                    <span>Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                    <span>Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center font-bold">1</div>
                    <span>Sequence #</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Station Sequence Display with visit status */}
            {selectedStations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Station Sequence ({selectedStations.length} stations)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedStations.map((stationId, index) => {
                      const visit = visits.find(v => v.station_tfl_id === stationId);
                      const visitStatus = visit ? visit.status : 'not_visited';
                      const statusColor = visitStatus === 'visited' ? 'bg-red-500' : 
                                         visitStatus === 'pending' ? 'bg-orange-500' : 'bg-white border-blue-500';
                      const statusText = visitStatus === 'visited' ? 'VERIFIED' : 
                                        visitStatus === 'pending' ? 'PENDING' : 'NOT VISITED';
                      
                      return (
                        <div key={stationId} className="flex items-center gap-3 p-2 bg-secondary rounded">
                          <span className={`w-6 h-6 ${statusColor} text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold border-2`}>
                            {index + 1}
                          </span>
                          <span className="font-medium flex-1">{getStationName(stationId)}</span>
                          <Badge variant={visitStatus === 'visited' ? 'default' : visitStatus === 'pending' ? 'outline' : 'secondary'} className="text-xs">
                            {statusText}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityMap;