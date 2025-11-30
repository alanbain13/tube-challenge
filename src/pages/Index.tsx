import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProfileSetup from "@/components/ProfileSetup";
import { Tutorial } from "@/components/Tutorial";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { ActionCard } from "@/components/ActionCard";
import { MapPin, Trophy, Activity, Award, Users, Zap, Route, Rss } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

const Index = () => {
  const { user, profile, loading, profileLoading } = useAuth();
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

  // Fetch friends list
  const { data: friendsList } = useQuery({
    queryKey: ["friends-list", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("friendships")
        .select("user_id_1, user_id_2")
        .eq("status", "accepted")
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      if (error) throw error;
      
      const friendIds = data.map(f => 
        f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
      );
      
      return friendIds;
    },
    enabled: !!user,
  });

  // Fetch combined feed (user + friends activities)
  const { data: combinedFeed = [], isLoading: feedLoading } = useQuery({
    queryKey: ["combined-feed", user?.id, friendsList],
    queryFn: async () => {
      if (!user || !friendsList) return [];

      const userIds = [user.id, ...friendsList];

      // Fetch activities
      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .in("user_id", userIds)
        .order("started_at", { ascending: false })
        .limit(20);

      if (activitiesError) throw activitiesError;

      // Fetch profiles for all users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Create profile map
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Enrich activities with profile data
      const enrichedActivities = activities?.map(activity => ({
        ...activity,
        profile: profileMap.get(activity.user_id),
        isCurrentUser: activity.user_id === user.id,
      })) || [];

      return enrichedActivities;
    },
    enabled: !!user && !!friendsList,
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
    <>
      <AppLayout>
        {/* Top Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard
            icon={MapPin}
            label="Stations Visited"
            value={totalVisited}
            iconColor="text-accent"
            loading={isLoadingAny}
          />
          <StatCard
            icon={Trophy}
            label="Challenges Done"
            value={linesCompleted}
            iconColor="text-action-orange"
            loading={isLoadingAny}
          />
          <StatCard
            icon={Activity}
            label="Active Now"
            value={weekly.activities}
            iconColor="text-action-green"
            loading={isLoadingAny}
          />
          <StatCard
            icon={Award}
            label="Badges Earned"
            value={linesCompleted}
            iconColor="text-primary"
            loading={isLoadingAny}
          />
          <StatCard
            icon={Users}
            label="Friends"
            value={0}
            iconColor="text-action-pink"
            loading={isLoadingAny}
          />
        </div>

        {/* Action Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ActionCard
            title="Start a Challenge"
            description="Test yourself with official challenges"
            icon={Zap}
            href="/challenges"
            colorClass="bg-gradient-to-br from-action-blue to-action-blue/80"
          />
          <ActionCard
            title="Create a Route"
            description="Plan your next tube adventure"
            icon={Route}
            href="/routes/create"
            colorClass="bg-gradient-to-br from-action-purple to-action-purple/80"
          />
          <ActionCard
            title="View Feed"
            description="See what your friends are doing"
            icon={Rss}
            href="/activities"
            colorClass="bg-gradient-to-br from-action-green to-action-green/80"
          />
        </div>

        {/* Recent Activities */}
        <Card className="mb-8">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-black">Recent Activities</CardTitle>
            <CardDescription>Your latest tube adventures</CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : activitiesData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities yet. Start your first activity!</p>
            ) : (
              <ul className="divide-y">
                {activitiesData.slice(0, 5).map((a: any) => (
                  <li 
                    key={a.id} 
                    className="py-4 flex items-center justify-between hover:bg-muted/50 -mx-6 px-6 cursor-pointer transition-colors"
                    onClick={() => navigate(`/activities/${a.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{a.title || 'Untitled Activity'}</div>
                        <div className="text-sm text-muted-foreground">
                          {a.station_tfl_ids?.length || 0} stations • {a.distance_km ? Number(a.distance_km).toFixed(1) : '0.0'} km
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(a.started_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Combined Feed (User + Friends) */}
        {friendsList && friendsList.length > 0 && (
          <Card className="mb-8">
            <CardHeader className="text-center">
              <CardTitle className="text-4xl font-black flex items-center justify-center gap-2">
                <Rss className="w-8 h-8" />
                Activity Feed
              </CardTitle>
              <CardDescription>Recent activities from you and your friends</CardDescription>
            </CardHeader>
            <CardContent>
              {feedLoading ? (
                <p className="text-sm text-muted-foreground">Loading feed...</p>
              ) : combinedFeed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities to show yet</p>
              ) : (
                <ul className="divide-y">
                  {combinedFeed.map((activity: any) => (
                    <li 
                      key={activity.id} 
                      className="py-4 flex items-center justify-between hover:bg-muted/50 -mx-6 px-6 cursor-pointer transition-colors"
                      onClick={() => navigate(`/activities/${activity.id}`)}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={activity.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {activity.profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold truncate">
                              {activity.isCurrentUser 
                                ? 'You' 
                                : (activity.profile?.display_name || activity.profile?.username || 'Unknown User')
                              }
                            </span>
                            <span className="text-muted-foreground text-sm">
                              {activity.title || 'Untitled Activity'}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {activity.station_tfl_ids?.length || 0} stations
                            {activity.distance_km && ` • ${Number(activity.distance_km).toFixed(1)} km`}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-nowrap ml-4">
                        {formatDistanceToNow(new Date(activity.started_at), { addSuffix: true })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Weekly & Monthly Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-4xl font-black">This Week</CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{weekly.activities}</div>
              <p className="text-sm text-muted-foreground">
                Activities • {weekly.distance.toFixed(1)} km travelled
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-4xl font-black">This Month</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{monthly.activities}</div>
              <p className="text-sm text-muted-foreground">
                Activities • {monthly.distance.toFixed(1)} km travelled
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
      <Tutorial open={showTutorial} onComplete={handleTutorialComplete} />
    </>
  );
};

export default Index;
