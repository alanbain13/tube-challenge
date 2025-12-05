import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Route, ChevronRight, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RouteItem {
  id: string;
  name: string;
  description: string | null;
  start_station_tfl_id: string;
  end_station_tfl_id: string;
  created_at: string;
}

interface RecentRoutesCardProps {
  routes: RouteItem[];
  loading?: boolean;
}

export function RecentRoutesCard({ routes, loading }: RecentRoutesCardProps) {
  const navigate = useNavigate();

  // Fetch station names for display
  const stationIds = routes.flatMap(r => [r.start_station_tfl_id, r.end_station_tfl_id]);
  const { data: stations = [] } = useQuery({
    queryKey: ['route-stations', stationIds],
    queryFn: async () => {
      if (stationIds.length === 0) return [];
      const { data, error } = await supabase
        .from('stations')
        .select('tfl_id, name')
        .in('tfl_id', stationIds);
      if (error) throw error;
      return data || [];
    },
    enabled: stationIds.length > 0,
  });

  const stationMap = new Map(stations.map(s => [s.tfl_id, s.name]));

  if (loading) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Route className="w-4 h-4" />
            My Routes
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

  const recentRoutes = routes.slice(0, 3);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Route className="w-4 h-4" />
            My Routes
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/routes')}
          >
            View All
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentRoutes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No routes yet
          </p>
        ) : (
          recentRoutes.map((route) => (
            <button
              key={route.id}
              onClick={() => navigate(`/routes/${route.id}`)}
              className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="p-1.5 rounded-md bg-muted">
                <Route className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {route.name}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">
                    {stationMap.get(route.start_station_tfl_id) || route.start_station_tfl_id} → {stationMap.get(route.end_station_tfl_id) || route.end_station_tfl_id}
                  </span>
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
