import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Lock } from "lucide-react";

export function ActiveMetrosCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get all metro systems
  const { data: metroSystems = [], isLoading: metrosLoading } = useQuery({
    queryKey: ['metro-systems-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_systems')
        .select('id, name, city, country, station_count, line_count, image_url, is_active')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Get user's activity counts per metro (via stations visited)
  const { data: userActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['user-metro-activity', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_visits')
        .select(`
          station_tfl_id,
          stations!inner (
            metro_system_id
          )
        `)
        .eq('user_id', user!.id)
        .eq('status', 'verified');
      if (error) throw error;
      
      // Count visits per metro system
      const metroVisits = new Map<string, number>();
      (data || []).forEach((visit: any) => {
        const metroId = visit.stations?.metro_system_id;
        if (metroId) {
          metroVisits.set(metroId, (metroVisits.get(metroId) || 0) + 1);
        }
      });
      
      return Array.from(metroVisits.entries()).map(([id, count]) => ({ id, count }));
    },
    enabled: !!user,
  });

  const isLoading = metrosLoading || activityLoading;

  // Sort metros: active ones with user activity first (by activity count desc), then other active, then inactive
  const sortedMetros = [...metroSystems].sort((a, b) => {
    const aActivity = userActivity.find(u => u.id === a.id)?.count || 0;
    const bActivity = userActivity.find(u => u.id === b.id)?.count || 0;
    
    // Active metros with activity first
    if (a.is_active && b.is_active) {
      if (aActivity !== bActivity) return bActivity - aActivity;
      return a.name.localeCompare(b.name);
    }
    // Active before inactive
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Metro Systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          {[1, 2].map(i => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            Metro Systems
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/metros')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-4">
        {sortedMetros.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No metro systems available
          </p>
        ) : (
          sortedMetros.slice(0, 4).map((metro) => {
            const activity = userActivity.find(u => u.id === metro.id)?.count || 0;
            const isActive = metro.is_active;
            
            return (
              <div 
                key={metro.id}
                className={`flex items-center gap-2.5 p-2 rounded-md transition-colors ${
                  isActive 
                    ? 'hover:bg-muted/50 cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
                onClick={() => isActive && navigate(`/metros/${metro.id}`)}
              >
                <div className="w-7 h-7 rounded bg-muted flex items-center justify-center overflow-hidden">
                  {metro.image_url ? (
                    <img src={metro.image_url} alt={metro.name} className="w-full h-full object-cover" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-foreground truncate">{metro.name}</p>
                    {!isActive && <Lock className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isActive ? (
                      activity > 0 ? (
                        <span className="text-primary">{activity} stations visited</span>
                      ) : (
                        `${metro.station_count || 0} stations`
                      )
                    ) : (
                      'Coming soon'
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
