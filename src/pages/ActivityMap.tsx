import React, { useEffect, useState } from 'react';
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

const ActivityMap = () => {
  const navigate = useNavigate();
  const { id: activityId } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
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
        .select('*')
        .eq('id', activityId)
        .single();

      if (error) {
        console.error('Error fetching activity:', error);
        navigate('/activities');
        return;
      }

      const activityData = data as Activity;
      console.log('📦 DATA: Activity map data loaded:', { 
        title: activityData.title, 
        stationCount: activityData.station_tfl_ids?.length || 0,
        startStation: activityData.start_station_tfl_id,
        endStation: activityData.end_station_tfl_id
      });
      setActivity(activityData);
      
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
            />

            {/* Station Sequence Display */}
            {selectedStations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Station Sequence ({selectedStations.length} stations)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedStations.map((stationId, index) => (
                      <div key={stationId} className="flex items-center gap-3 p-2 bg-secondary rounded">
                        <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium">{getStationName(stationId)}</span>
                      </div>
                    ))}
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