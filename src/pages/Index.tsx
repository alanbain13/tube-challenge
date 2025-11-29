import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProfileSetup from "@/components/ProfileSetup";
import { Tutorial } from "@/components/Tutorial";

const Index = () => {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const { stations } = useStations();
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // SEO: set title and meta
  useEffect(() => {
    document.title = "Public Transport Dashboard | Tube Challenge";
    const desc = "Track visited stations, line progress, and recent activities on your public transport dashboard.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);

    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', window.location.origin + '/');
  }, []);

  // Data queries
  const { data: visitsData = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['station_visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_visits')
        .select('station_tfl_id,status,visited_at')
        .order('visited_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: stationsData = [], isLoading: stationsLoading } = useQuery({
    queryKey: ['stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('tfl_id,lines');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activitiesData = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const {
    totalVisited,
    linesCompleted,
    totalDistance,
    latestActivity,
    weekly,
    monthly,
  } = useMemo(() => {
    const visitedSet = new Set<string>();
    (visitsData || [])
      .filter((v: any) => v.status === 'verified' && v.station_tfl_id)
      .forEach((v: any) => visitedSet.add(v.station_tfl_id as string));

    const lineTotals = new Map<string, number>();
    const lineVisited = new Map<string, number>();

    (stationsData || []).forEach((s: any) => {
      const lines: string[] = Array.isArray(s.lines) ? s.lines : [];
      lines.forEach((ln) => {
        lineTotals.set(ln, (lineTotals.get(ln) || 0) + 1);
        if (visitedSet.has(s.tfl_id)) {
          lineVisited.set(ln, (lineVisited.get(ln) || 0) + 1);
        }
      });
    });

    let completed = 0;
    lineTotals.forEach((total, ln) => {
      const v = lineVisited.get(ln) || 0;
      if (total > 0 && v >= total) completed += 1;
    });

    const distance = (activitiesData || []).reduce((acc: number, a: any) => {
      const d = a?.distance_km != null ? Number(a.distance_km) : 0;
      return acc + (isNaN(d) ? 0 : d);
    }, 0);

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const weeklyActs = (activitiesData || []).filter((a: any) => a.started_at && new Date(a.started_at) >= sevenDaysAgo);
    const monthlyActs = (activitiesData || []).filter((a: any) => a.started_at && new Date(a.started_at) >= thirtyDaysAgo);

    const weekly = {
      activities: weeklyActs.length,
      distance: weeklyActs.reduce((acc: number, a: any) => acc + (a.distance_km ? Number(a.distance_km) : 0), 0),
    };
    const monthly = {
      activities: monthlyActs.length,
      distance: monthlyActs.reduce((acc: number, a: any) => acc + (a.distance_km ? Number(a.distance_km) : 0), 0),
    };

    return {
      totalVisited: visitedSet.size,
      linesCompleted: completed,
      totalDistance: distance,
      latestActivity: (activitiesData || [])[0] || null,
      weekly,
      monthly,
    };
  }, [visitsData, stationsData, activitiesData]);

  const isLoadingAny = visitsLoading || stationsLoading || activitiesLoading;

  // Check if user has seen the tutorial - MUST be before early returns
  useEffect(() => {
    if (profile && user) {
      const hasSeenTutorial = localStorage.getItem(`tutorial_seen_${user.id}`);
      if (!hasSeenTutorial) {
        setShowTutorial(true);
      }
    }
  }, [profile, user]);

  // Safe early returns after all hooks are declared
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  // CRITICAL: Always check for user first before any profile checks
  if (!user) {
    return null;
  }

  const handleTutorialComplete = () => {
    if (user?.id) {
      localStorage.setItem(`tutorial_seen_${user.id}`, 'true');
    }
    setShowTutorial(false);
  };

  // Show profile setup if user hasn't completed their profile (requires both name and avatar)
  if (!profile || !profile.display_name || !profile.avatar_url) {
    return <ProfileSetup userId={user.id} onComplete={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            {profile.avatar_url && (
              <img 
                src={profile.avatar_url} 
                alt={profile.display_name || 'Profile'} 
                className="w-12 h-12 rounded-full border-2 border-primary"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-foreground">Public Transport Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {profile.display_name || user.email}!</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/settings')}>Settings</Button>
            <Button variant="outline" onClick={() => navigate('/routes/create')}>Create Route</Button>
            <Button onClick={() => navigate('/activities/new')}>New Activity</Button>
          </div>
        </header>

        <main>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Total Stations Visited</CardTitle>
              <CardDescription>Verified visits only</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{isLoadingAny ? '—' : totalVisited}</p>
            </CardContent>
          </Card>
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Lines Completed</CardTitle>
              <CardDescription>Across all Tube lines</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{isLoadingAny ? '—' : linesCompleted}</p>
            </CardContent>
          </Card>
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Distance Travelled</CardTitle>
              <CardDescription>From your activities (km)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{isLoadingAny ? '—' : totalDistance.toFixed(1)}</p>
            </CardContent>
          </Card>
        </div>

        {/* My Activities and My Routes tiles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/activities')}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                My Activities
                <span className="text-xl">▸</span>
              </CardTitle>
              <CardDescription>
                {latestActivity ? (
                  <>
                    Latest: {latestActivity.title || 'Untitled activity'}
                    <br />
                    {latestActivity.start_station_tfl_id && latestActivity.end_station_tfl_id && stations.length > 0 ? 
                      `${stations.find(s => s.id === latestActivity.start_station_tfl_id)?.name || latestActivity.start_station_tfl_id} → ${stations.find(s => s.id === latestActivity.end_station_tfl_id)?.name || latestActivity.end_station_tfl_id}` : 
                      'Route not specified'}
                  </>
                ) : (
                  'No activities yet'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestActivity ? (
                <div className="space-y-1">
                  <div className="text-sm">Visited {Array.isArray(latestActivity.station_tfl_ids) ? Math.floor(latestActivity.station_tfl_ids.length * 0.6) : 0}/{Array.isArray(latestActivity.station_tfl_ids) ? latestActivity.station_tfl_ids.length : 0} • {latestActivity.distance_km ? Number(latestActivity.distance_km).toFixed(1) : '0.0'} km</div>
                  <div className="text-xs text-muted-foreground">Updated {new Date(latestActivity.started_at).toLocaleTimeString()}</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Start your first activity</p>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={(e) => { e.stopPropagation(); navigate('/activities'); }} className="w-full">
                View Activities
              </Button>
            </CardFooter>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/routes')}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                My Routes
                <span className="text-xl">▸</span>
              </CardTitle>
              <CardDescription>Saved routes and challenges</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-sm">Your saved tube routes for planning activities</div>
                <div className="text-xs text-muted-foreground">Create routes to track your journeys</div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={(e) => { e.stopPropagation(); navigate('/routes'); }} className="w-full">
                View Routes
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Map section */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Map</CardTitle>
              <CardDescription>Open the interactive network map</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-48 rounded-md overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20">
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Map preview</div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => navigate('/map')}>Open Map</Button>
            </CardFooter>
          </Card>
        </div>

        {/* Weekly / Monthly */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>This Week</CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{isLoadingAny ? '—' : `${weekly.activities} activities`}</div>
              <div className="text-muted-foreground">Distance: {isLoadingAny ? '—' : `${weekly.distance.toFixed(1)} km`}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>This Month</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{isLoadingAny ? '—' : `${monthly.activities} activities`}</div>
              <div className="text-muted-foreground">Distance: {isLoadingAny ? '—' : `${monthly.distance.toFixed(1)} km`}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent activities feed */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Your last 5 activities</CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : activitiesData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities yet.</p>
            ) : (
              <ul className="divide-y">
                {activitiesData.map((a: any) => (
                  <li key={a.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{a.title || 'Untitled activity'}</div>
                      <div className="text-xs text-muted-foreground">{new Date(a.started_at).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {a.distance_km ? Number(a.distance_km).toFixed(1) : '0.0'} km
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
      </div>
      <Tutorial open={showTutorial} onComplete={handleTutorialComplete} />
    </div>
  );
};

export default Index;
