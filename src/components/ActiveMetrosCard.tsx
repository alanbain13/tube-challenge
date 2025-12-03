import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin } from "lucide-react";

export function ActiveMetrosCard() {
  const navigate = useNavigate();

  const { data: metroSystems = [], isLoading } = useQuery({
    queryKey: ['metro-systems-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_systems')
        .select('id, name, city, country, station_count, line_count, image_url')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
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
      <CardContent className="space-y-2 px-4 pb-4">
        {metroSystems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No active metro systems
          </p>
        ) : (
          metroSystems.slice(0, 3).map((metro) => (
            <div 
              key={metro.id}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/metros/${metro.id}`)}
            >
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden">
                {metro.image_url ? (
                  <img src={metro.image_url} alt={metro.name} className="w-full h-full object-cover" />
                ) : (
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{metro.name}</p>
                <p className="text-xs text-muted-foreground">
                  {metro.city}, {metro.country} • {metro.station_count || 0} stations
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
