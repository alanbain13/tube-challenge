import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ChevronRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface ActivityItem {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  status: string | null;
  station_tfl_ids: string[];
}

interface RecentActivitiesCardProps {
  activities: ActivityItem[];
  loading?: boolean;
}

export function RecentActivitiesCard({ activities, loading }: RecentActivitiesCardProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Activities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const recentActivities = activities.slice(0, 3);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Activities
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/activities')}
          >
            View All
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activities yet
          </p>
        ) : (
          recentActivities.map((activity) => (
            <button
              key={activity.id}
              onClick={() => navigate(`/activities/${activity.id}`)}
              className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="p-1.5 rounded-md bg-muted">
                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {activity.title || "Untitled Activity"}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{format(new Date(activity.started_at), "MMM d")}</span>
                  <span>·</span>
                  <span>{activity.station_tfl_ids?.length || 0} stations</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
