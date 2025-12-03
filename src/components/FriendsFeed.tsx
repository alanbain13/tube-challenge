import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeedActivity {
  id: string;
  title: string | null;
  started_at: string;
  station_tfl_ids: string[];
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  isCurrentUser: boolean;
}

interface FriendsFeedProps {
  activities: FeedActivity[];
  loading?: boolean;
  hasFriends: boolean;
}

export function FriendsFeed({ activities, loading = false, hasFriends }: FriendsFeedProps) {
  const navigate = useNavigate();

  if (!hasFriends) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Friend Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-2 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const friendActivities = activities.filter(a => !a.isCurrentUser).slice(0, 3);

  if (friendActivities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Friend Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent friend activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Friend Activity
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => navigate('/activities')}
          >
            See All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {friendActivities.map((activity) => (
          <div 
            key={activity.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => navigate(`/activities/${activity.id}`)}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={activity.profile?.avatar_url || undefined} />
              <AvatarFallback>
                {activity.profile?.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold">
                  {activity.profile?.display_name || 'Unknown'}
                </span>
                {' '}
                <span className="text-muted-foreground">
                  visited {activity.station_tfl_ids?.length || 0} stations
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.started_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
