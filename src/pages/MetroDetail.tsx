import { AppLayout } from "@/components/AppLayout";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import ReadOnlyMetroMap from "@/components/ReadOnlyMetroMap";
import MetroProgressStats from "@/components/MetroProgressStats";
import LineProgressGrid from "@/components/LineProgressGrid";
import StationChecklist from "@/components/StationChecklist";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useMemo } from "react";
interface MetroSystem {
  id: string;
  name: string;
  city: string;
  country: string;
  code: string;
  station_count: number;
  line_count: number;
}

interface Line {
  id: string;
  name: string;
  display_name: string;
  line_type: string;
  color: string;
  sort_order: number;
}

interface Station {
  id: string;
  name: string;
  displayName: string;
  lines: string[];
  zone: string;
  coordinates: [number, number];
}

export default function MetroDetail() {
  const { metroId } = useParams<{ metroId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch metro system info
  const { data: metro, isLoading: metroLoading } = useQuery({
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

  // Fetch lines for this metro system
  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ['lines', metro?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lines')
        .select('*')
        .eq('metro_system_id', metro!.id)
        .eq('line_type', 'tube')
        .order('sort_order');
      
      if (error) throw error;
      return data as Line[];
    },
    enabled: !!metro?.id
  });

  // Use the useStations hook for map display (properly filtered station-level data from GeoJSON)
  const { stations: allStationsFromGeoJSON, loading: stationsLoading } = useStations();

  // Fetch tube stations only for Line Progress and Station Checklist
  const { data: tubeStations, isLoading: tubeStationsLoading } = useQuery({
    queryKey: ['tube-stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .like('tfl_id', '940GZZLU%');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch user's verified visits from activities
  const { data: verifiedVisits, isLoading: visitsLoading } = useQuery({
    queryKey: ['verified-visits', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('station_visits')
        .select('station_tfl_id, visited_at')
        .eq('user_id', user.id)
        .eq('status', 'verified')
        .not('activity_id', 'is', null);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Transform stations from useStations hook for map display
  const allStationsForMap: Station[] = useMemo(() => {
    return allStationsFromGeoJSON.map(s => ({
      id: s.id,
      name: s.name,
      displayName: s.displayName,
      lines: s.lines.map(l => l.name),
      zone: s.zone,
      coordinates: s.coordinates
    }));
  }, [allStationsFromGeoJSON]);

  // Transform tube stations only for Line Progress and Station Checklist
  const tubeStationsOnly: Station[] = useMemo(() => {
    if (!tubeStations) return [];
    return tubeStations.map(s => ({
      id: s.tfl_id,
      name: s.name,
      displayName: s.name,
      lines: s.lines || [],
      zone: s.zone,
      coordinates: [s.longitude, s.latitude] as [number, number]
    }));
  }, [tubeStations]);

  const verifiedVisitIds = useMemo(() => {
    return verifiedVisits?.map(v => v.station_tfl_id) || [];
  }, [verifiedVisits]);

  // Calculate progress statistics
  const stats = useMemo(() => {
    const visitedCount = verifiedVisitIds.length;
    const totalStations = metro?.station_count || 0;
    const progressPercent = totalStations > 0 
      ? Math.round((visitedCount / totalStations) * 100) 
      : 0;

    // Calculate pace (visits per week)
    let currentPace = 0;
    if (verifiedVisits && verifiedVisits.length > 1) {
      const sortedVisits = [...verifiedVisits].sort((a, b) => 
        new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime()
      );
      const firstVisit = new Date(sortedVisits[0].visited_at);
      const lastVisit = new Date(sortedVisits[sortedVisits.length - 1].visited_at);
      const daysDiff = (lastVisit.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 0) {
        currentPace = (verifiedVisits.length / daysDiff) * 7; // per week
      }
    }

    // Calculate estimated completion
    let estimatedCompletion = undefined;
    if (currentPace > 0 && visitedCount < totalStations) {
      const remaining = totalStations - visitedCount;
      const weeksNeeded = remaining / currentPace;
      const completionDate = new Date();
      completionDate.setDate(completionDate.getDate() + weeksNeeded * 7);
      estimatedCompletion = completionDate.toLocaleDateString('en-GB', { 
        month: 'short', 
        year: 'numeric' 
      });
    }

    return { visitedCount, totalStations, progressPercent, currentPace, estimatedCompletion };
  }, [verifiedVisits, verifiedVisitIds, metro]);

  // Calculate per-line progress (tube lines only)
  const lineProgress = useMemo(() => {
    if (!lines || !tubeStationsOnly) return [];
    
    return lines.map(line => {
      const lineStations = tubeStationsOnly.filter(s => s.lines.includes(line.name));
      const visitedInLine = lineStations.filter(s => verifiedVisitIds.includes(s.id)).length;
      const percentage = lineStations.length > 0 
        ? Math.round((visitedInLine / lineStations.length) * 100)
        : 0;

      return {
        line,
        visitedCount: visitedInLine,
        totalCount: lineStations.length,
        percentage
      };
    });
  }, [lines, tubeStationsOnly, verifiedVisitIds]);

  const isLoading = metroLoading || linesLoading || stationsLoading || tubeStationsLoading || visitsLoading;

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
          
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            {metro.city} - {metro.name}
          </h1>
          <p className="text-muted-foreground">
            Track your journey across all {metro.name} stations
          </p>
        </div>

        <MetroProgressStats
          visitedCount={stats.visitedCount}
          totalStations={stats.totalStations}
          progressPercent={stats.progressPercent}
          currentPace={stats.currentPace}
          estimatedCompletion={stats.estimatedCompletion}
        />

        <Card className="mb-6 overflow-hidden">
          <ReadOnlyMetroMap
            stations={allStationsForMap}
            verifiedVisits={verifiedVisitIds}
            center={[-0.1276, 51.5074]}
            zoom={10}
          />
        </Card>

        <Tabs defaultValue="lines" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="lines">Line Progress</TabsTrigger>
            <TabsTrigger value="checklist">Station Checklist</TabsTrigger>
          </TabsList>
          
          <TabsContent value="lines">
            <LineProgressGrid lineProgress={lineProgress} />
          </TabsContent>
          
          <TabsContent value="checklist">
            <StationChecklist
              lines={lines || []}
              stations={tubeStationsOnly}
              verifiedVisits={verifiedVisitIds}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}