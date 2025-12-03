import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, MapPin, Route, ArrowRight } from "lucide-react";
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Your Latest Adventure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!activity) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Your Latest Adventure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No activities yet. Start your first journey!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Your Latest Adventure</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => navigate('/activities')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
          onClick={() => navigate(`/activities/${activity.id}`)}
        >
          <div className="p-3 rounded-full bg-primary/10 flex-shrink-0">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              {activity.title || "Untitled Activity"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(activity.started_at), { addSuffix: true })}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {activity.station_tfl_ids?.length || 0} stations
              </span>
              {activity.distance_km && (
                <span className="flex items-center gap-1">
                  <Route className="w-3 h-3" />
                  {Number(activity.distance_km).toFixed(1)} km
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
