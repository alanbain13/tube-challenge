import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/useStations';
import { useActivityState } from '@/hooks/useActivityState';
import RouteMap from '@/components/RouteMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from 'lucide-react';


interface UnifiedActivityMapProps {
  activityId: string;
  activity?: {
    id: string;
    title?: string;
    start_station_tfl_id?: string;
    end_station_tfl_id?: string;
    status: string;
  };
}

// Interface matching RouteMap component
interface RouteMapStationVisit {
  station_tfl_id: string;
  status: 'pending' | 'verified' | 'rejected';
  sequence_number: number;
}

const UnifiedActivityMap: React.FC<UnifiedActivityMapProps> = ({ activityId, activity }) => {
  const navigate = useNavigate();
  const { stations } = useStations();
  const { data: activityState, isLoading } = useActivityState(activityId);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [visits, setVisits] = useState<RouteMapStationVisit[]>([]);
  

  useEffect(() => {
    if (activityState) {
      // For planned activities, show all planned stations
      if (activityState.mode === 'planned' && activityState.remaining) {
        const allPlannedStations = [
          ...activityState.visited.map(v => v.station_tfl_id),
          ...activityState.remaining.map(r => r.station_tfl_id)
        ];
        
        // Remove duplicates and preserve sequence
        const uniqueStations = Array.from(new Set(allPlannedStations));
        setSelectedStations(uniqueStations);
      } else {
        // For unplanned activities, show only visited stations
        setSelectedStations(activityState.visited.map(v => v.station_tfl_id));
      }

      // Convert to visits format for RouteMap
      const mapVisits: RouteMapStationVisit[] = activityState.visited.map(visit => ({
        station_tfl_id: visit.station_tfl_id,
        status: visit.status,
        sequence_number: visit.seq_actual
      }));
      setVisits(mapVisits);
    }
  }, [activityState]);

  const getStationName = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    return station ? station.displayName : stationId;
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading activity map...</p>
      </div>
    );
  }

  if (!activityState || !activity) {
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

  const { mode, visited, remaining, visitedCount, totalPlannedCount } = activityState;

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
                <p className="text-muted-foreground">
                  {mode === 'planned' ? 'Planned Activity' : 'Unplanned Activity'} - Interactive route visualization
                </p>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">Mode</div>
                    <Badge variant={mode === 'planned' ? 'default' : 'outline'}>
                      {mode === 'planned' ? 'Planned' : 'Unplanned'}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Visited</div>
                    <div className="font-medium">{visitedCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Remaining</div>
                    <div className="font-medium">
                      {mode === 'planned' ? (remaining?.length || 0) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Planned</div>
                    <div className="font-medium">{totalPlannedCount || 'Open-ended'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Always show map container */}
            <div className="min-h-[400px]">
              <RouteMap
                selectedStations={selectedStations}
                onStationSelect={() => {}}
                onStationRemove={() => {}}
                onSequenceChange={() => {}}
                readOnly={true}
                activityStations={selectedStations}
                visits={visits}
                activityMode={mode}
              />
            </div>

            {/* Map Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Map Legend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#dc143c] rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold">1</div>
                    <span>🔴 Visited (1…n)</span>
                  </div>
                  {mode === 'planned' && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#4169e1] rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold">2</div>
                      <span>🔵 Planned (1…n)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 bg-[#9ca3af]"></div>
                    <span>Grey solid = visited path</span>
                  </div>
                  {mode === 'planned' && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-1 bg-[#9ca3af]" style={{backgroundImage: 'repeating-linear-gradient(90deg, #9ca3af 0, #9ca3af 4px, transparent 4px, transparent 10px)'}}></div>
                      <span>Grey dotted = planned path</span>
                    </div>
                  )}
                </div>
                
                {mode === 'unplanned' && visitedCount === 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700">
                      This is an unplanned activity. Check in to your first station to draw your route.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Station Progress Display */}
            {visited.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Visited Stations ({visited.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {visited.map((visit) => (
                      <div key={`${visit.station_tfl_id}-${visit.seq_actual}`} className="flex items-center gap-3 p-2 bg-secondary rounded">
                        <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {visit.seq_actual}
                        </span>
                        <span className="font-medium flex-1">{getStationName(visit.station_tfl_id)}</span>
                        <Badge variant={visit.status === 'verified' ? 'default' : 'outline'} className="text-xs">
                          {visit.status === 'verified' ? 'VERIFIED' : 'PENDING'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Remaining Planned Stations (for planned activities only) */}
            {mode === 'planned' && remaining && remaining.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Remaining Stations ({remaining.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {remaining.map((item) => (
                      <div key={`${item.station_tfl_id}-${item.seq_planned}`} className="flex items-center gap-3 p-2 bg-blue-50 rounded">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {item.seq_planned}
                        </span>
                        <span className="font-medium flex-1">{getStationName(item.station_tfl_id)}</span>
                        <Badge variant="outline" className="text-xs">
                          PLANNED
                        </Badge>
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

export default UnifiedActivityMap;