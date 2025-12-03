import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Activity, ArrowRight, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeedActivity {
  id: string;
  title: string | null;
  started_at: string;
  station_tfl_ids: string[];
  status: string | null;
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
        <CardContent className="space-y-2 px-4 pb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-2 bg-muted animate-pulse rounded w-1/2" />
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
            See All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-4">
        {displayActivities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No recent activity
          </p>
        ) : (
          displayActivities.map((activity) => (
            <div 
              key={activity.id}
              className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/activities/${activity.id}`)}
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={activity.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {activity.isCurrentUser ? (
                    <User className="w-3.5 h-3.5" />
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
                  {' '}
                  <span className="text-muted-foreground">
                    • {activity.station_tfl_ids?.length || 0} stations
                  </span>
                  {activity.status === 'active' && (
                    <span className="ml-1 text-xs text-primary">• Active</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activity.title || 'Activity'} • {formatDistanceToNow(new Date(activity.started_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
