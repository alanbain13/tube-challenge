import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Activity, ArrowRight, User, Clock } from "lucide-react";
import { formatDistanceToNow, differenceInSeconds } from "date-fns";
import { MiniMapSnapshot } from "@/components/MiniMapSnapshot";
import { VerificationLevelBadge } from "@/components/VerificationLevelBadge";

interface FeedActivity {
  id: string;
  title: string | null;
  started_at: string;
  station_tfl_ids: string[];
  status: string | null;
  ended_at?: string | null;
  verification_level?: string | null;
  gate_start_at?: string | null;
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

  // Calculate elapsed time from gate_start_at to ended_at
  const getElapsedTime = (activity: FeedActivity) => {
    if (!activity.gate_start_at || !activity.ended_at) return null;
    const seconds = differenceInSeconds(
      new Date(activity.ended_at),
      new Date(activity.gate_start_at)
    );
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Activity Feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-6 h-6 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="h-4 bg-muted animate-pulse rounded flex-1" />
              <div className="w-16 h-10 bg-muted animate-pulse rounded" />
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
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/activities')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 px-4 pb-4">
        {displayActivities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No recent activity
          </p>
        ) : (
          displayActivities.map((activity) => {
            const elapsed = getElapsedTime(activity);
            const lastCheckinTime = activity.ended_at || activity.started_at;
            
            return (
              <div 
                key={activity.id}
                className="flex items-center gap-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer p-1.5"
                onClick={() => navigate(`/activities/${activity.id}`)}
              >
                {/* User Icon */}
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

                {/* Activity Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {activity.title || 'Activity'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.isCurrentUser ? 'You' : (activity.profile?.display_name || 'Friend')}
                  </p>
                </div>

                {/* Thumbnail - constrained width */}
                {activity.station_tfl_ids && activity.station_tfl_ids.length > 0 && (
                  <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0">
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

                {/* Last Station Time Checkin */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(lastCheckinTime), { addSuffix: true })}
                  </p>
                </div>

                {/* Elapsed Time */}
                {elapsed && (
                  <div className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {elapsed}
                  </div>
                )}

                {/* Verification Level */}
                {activity.status === 'completed' && (
                  <div className="flex-shrink-0">
                    <VerificationLevelBadge 
                      level={activity.verification_level || 'remote_verified'} 
                      compact 
                      showTooltip={false}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
