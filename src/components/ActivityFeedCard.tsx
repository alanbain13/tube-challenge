import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Activity, ArrowRight, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MiniMapSnapshot } from "@/components/MiniMapSnapshot";

interface FeedActivity {
  id: string;
  title: string | null;
  started_at: string;
  station_tfl_ids: string[];
  status: string | null;
  ended_at?: string | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  isCurrentUser: boolean;
}

interface ActivityFeedCardProps {
  activities: FeedActivity[];
  loading?: boolean;
}

export function ActivityFeedCard({ activities, loading = false }: ActivityFeedCardProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Activity Feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const displayActivities = activities.slice(0, 5);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            Activity Feed
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/activities')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {displayActivities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No recent activity
          </p>
        ) : (
          displayActivities.map((activity) => (
            <div 
              key={activity.id}
              className="rounded-md hover:bg-muted/50 transition-colors cursor-pointer p-2"
              onClick={() => navigate(`/activities/${activity.id}`)}
            >
              {/* Header row with avatar and info */}
              <div className="flex items-center gap-2.5 mb-2">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={activity.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {activity.isCurrentUser ? (
                      <User className="w-3 h-3" />
                    ) : (
                      activity.profile?.display_name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-medium text-foreground">
                      {activity.isCurrentUser ? 'You' : (activity.profile?.display_name || 'Unknown')}
                    </span>
                    <span className="text-muted-foreground">
                      {' · '}{formatDistanceToNow(new Date(activity.started_at), { addSuffix: true })}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.title || 'Activity'} · {activity.station_tfl_ids?.length || 0} stations
                    {activity.status === 'active' && (
                      <span className="ml-1 text-primary">· Active</span>
                    )}
                  </p>
                </div>
              </div>
              
              {/* Mini map thumbnail */}
              {activity.station_tfl_ids && activity.station_tfl_ids.length > 0 && (
                <div className="h-20 rounded overflow-hidden">
                  <MiniMapSnapshot
                    type="activity"
                    id={activity.id}
                    stationSequence={activity.station_tfl_ids}
                    visitedStations={activity.station_tfl_ids.map((id, idx) => ({ 
                      station_tfl_id: id, 
                      seq_actual: idx + 1 
                    }))}
                    remainingStations={[]}
                    lastVisitAt={activity.ended_at || activity.started_at}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
