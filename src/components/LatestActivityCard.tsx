import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LatestActivityCardProps {
  activity: {
    id: string;
    title: string | null;
    started_at: string;
    station_tfl_ids: string[];
    distance_km: number | null;
    status: string | null;
  } | null;
  loading?: boolean;
}

export function LatestActivityCard({ activity, loading = false }: LatestActivityCardProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-16 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!activity) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground text-center py-4">
            No activities yet. Start your first journey!
          </p>
        </CardContent>
      </Card>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(activity.started_at), { addSuffix: true });
  const stationCount = activity.station_tfl_ids?.length || 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
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
      <CardContent className="px-4 pb-4">
        <div 
          className="p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => navigate(`/activities/${activity.id}`)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {activity.title || "Untitled Activity"}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {stationCount} stations
                </span>
              </div>
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${
              activity.status === 'completed' 
                ? 'bg-green-500/10 text-green-600' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {activity.status || 'draft'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
