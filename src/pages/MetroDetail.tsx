import { AppLayout } from "@/components/AppLayout";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Map from "@/components/Map";
import { Skeleton } from "@/components/ui/skeleton";

interface MetroSystem {
  id: string;
  name: string;
  city: string;
  country: string;
  code: string;
  station_count: number;
  line_count: number;
}

export default function MetroDetail() {
  const { metroId } = useParams<{ metroId: string }>();
  const navigate = useNavigate();

  const { data: metro, isLoading } = useQuery({
    queryKey: ['metro-system', metroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_systems')
        .select('*')
        .eq('code', metroId)
        .single();
      
      if (error) throw error;
      return data as MetroSystem;
    },
    enabled: !!metroId
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Skeleton className="h-10 w-32 mb-4" />
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  if (!metro) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Metro System Not Found</h1>
          <Button onClick={() => navigate('/metros')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Metro Systems
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/metros')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Metro Systems
          </Button>
          
          <h1 className="text-3xl font-bold mb-2 text-foreground">{metro.city} - {metro.name}</h1>
          <p className="text-muted-foreground">
            {metro.station_count} stations across {metro.line_count} lines • 
            Your visited stations are highlighted on the map
          </p>
        </div>

        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <Map />
        </div>
      </div>
    </AppLayout>
  );
}
