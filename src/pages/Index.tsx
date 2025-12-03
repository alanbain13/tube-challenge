import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProfileSetup from "@/components/ProfileSetup";
import { Tutorial } from "@/components/Tutorial";
import { AppLayout } from "@/components/AppLayout";
import ActivityStartModal from "@/components/ActivityStartModal";
import { HeroProgress } from "@/components/HeroProgress";
import { ActiveJourneyCard } from "@/components/ActiveJourneyCard";
import { QuickActions } from "@/components/QuickActions";
import { QuickLineProgress } from "@/components/QuickLineProgress";
import { SmartSuggestions } from "@/components/SmartSuggestions";
import { LatestActivityCard } from "@/components/LatestActivityCard";
import { FriendsFeed } from "@/components/FriendsFeed";

const TOTAL_STATIONS = 272; // London Underground stations

const Index = () => {
  const { user, profile, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // SEO: set title and meta
  useEffect(() => {
    document.title = "Dashboard | Tube Challenge";
    const desc = "Track your London Underground journey. View progress, start activities, and compete with friends.";
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

  // Station visits query
  const { data: visitsData = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['station_visits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_visits')
        .select('station_tfl_id,status,visited_at')
        .eq('user_id', user!.id)
        .order('visited_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Stations query with line info
  const { data: stationsData = [], isLoading: stationsLoading } = useQuery({
    queryKey: ['stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('tfl_id,name,lines');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Lines query
  const { data: linesData = [] } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lines')
        .select('id,name,color,line_type')
        .eq('line_type', 'tube');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Activities query
  const { data: activitiesData = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Active activity query
  const { data: activeActivity } = useQuery({
    queryKey: ['active-activity', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Active activity visit count
  const { data: activeVisitCount = 0 } = useQuery({
    queryKey: ['active-visit-count', activeActivity?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('station_visits')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', activeActivity!.id)
        .in('status', ['verified', 'pending']);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!activeActivity?.id,
  });

  // Friends list
  const { data: friendsList = [] } = useQuery({
    queryKey: ["friends-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id_1, user_id_2")
        .eq("status", "accepted")
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
      if (error) throw error;
      return data.map(f => f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1);
    },
    enabled: !!user,
  });

  // Combined feed
  const { data: combinedFeed = [], isLoading: feedLoading } = useQuery({
    queryKey: ["combined-feed", user?.id, friendsList],
    queryFn: async () => {
      if (!user || friendsList.length === 0) return [];
      const userIds = [user.id, ...friendsList];

      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .in("user_id", userIds)
        .order("started_at", { ascending: false })
        .limit(20);
      if (activitiesError) throw activitiesError;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return activities?.map(activity => ({
        ...activity,
        profile: profileMap.get(activity.user_id),
        isCurrentUser: activity.user_id === user.id,
      })) || [];
    },
    enabled: !!user && friendsList.length > 0,
  });

  // Computed stats
  const {
    totalVisited,
    weeklyStations,
    streak,
    lineProgress,
    latestActivity,
    suggestions,
  } = useMemo(() => {
    const visitedSet = new Set<string>();
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    let weeklyCount = 0;
    const dailyVisits = new Map<string, boolean>();

    (visitsData || [])
      .filter((v: any) => v.status === 'verified' && v.station_tfl_id)
      .forEach((v: any) => {
        visitedSet.add(v.station_tfl_id as string);
        const visitDate = new Date(v.visited_at);
        if (visitDate >= sevenDaysAgo) {
          weeklyCount++;
        }
        // Track daily visits for streak
        const dateKey = visitDate.toISOString().split('T')[0];
        dailyVisits.set(dateKey, true);
      });

    // Calculate streak (consecutive days)
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateKey = checkDate.toISOString().split('T')[0];
      if (dailyVisits.has(dateKey)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    // Calculate line progress
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

    const lineProgress = (linesData || []).map((line: any) => {
      const total = lineTotals.get(line.name) || 0;
      const visited = lineVisited.get(line.name) || 0;
      return {
        lineId: line.id,
        lineName: line.name,
        color: line.color || '#888',
        visited,
        total,
        percentage: total > 0 ? Math.round((visited / total) * 100) : 0,
      };
    });

    // Generate suggestions
    const suggestions: any[] = [];
    
    // Find closest to completion line
    const nearCompletion = lineProgress
      .filter(l => l.percentage > 50 && l.percentage < 100)
      .sort((a, b) => b.percentage - a.percentage)[0];
    
    if (nearCompletion) {
      const remaining = nearCompletion.total - nearCompletion.visited;
      suggestions.push({
        type: "line-completion",
        title: `Complete the ${nearCompletion.lineName}`,
        description: `You're ${remaining} station${remaining > 1 ? 's' : ''} away from completing this line!`,
        action: "View Line",
        href: "/metros/london-underground",
        icon: "target",
      });
    }

    // Add challenge suggestion if user has few activities
    if ((activitiesData || []).length < 3) {
      suggestions.push({
        type: "challenge",
        title: "Try a Challenge",
        description: "Complete an official challenge to earn badges and compete on leaderboards.",
        action: "Browse",
        href: "/challenges",
        icon: "trophy",
      });
    }

    const latestActivity = (activitiesData || []).find((a: any) => a.status !== 'active') || null;

    return {
      totalVisited: visitedSet.size,
      weeklyStations: weeklyCount,
      streak,
      lineProgress,
      latestActivity,
      suggestions,
    };
  }, [visitsData, stationsData, linesData, activitiesData]);

  const isLoadingAny = visitsLoading || stationsLoading || activitiesLoading;

  // Tutorial check
  useEffect(() => {
    if (profile && user) {
      const hasSeenTutorial = localStorage.getItem(`tutorial_seen_${user.id}`);
      if (!hasSeenTutorial) {
        setShowTutorial(true);
      }
    }
  }, [profile, user]);

  // Loading state
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleTutorialComplete = () => {
    if (user?.id) {
      localStorage.setItem(`tutorial_seen_${user.id}`, 'true');
    }
    setShowTutorial(false);
  };

  // Profile setup
  if (!profile || !profile.display_name || !profile.avatar_url) {
    return <ProfileSetup userId={user.id} onComplete={() => window.location.reload()} />;
  }

  return (
    <>
      <AppLayout>
        <div className="space-y-6">
          {/* Hero Section */}
          <HeroProgress
            displayName={profile.display_name || "Explorer"}
            stationsVisited={totalVisited}
            totalStations={TOTAL_STATIONS}
            weeklyStations={weeklyStations}
            streak={streak}
            onStartActivity={() => setShowActivityModal(true)}
            loading={isLoadingAny}
          />

          {/* Active Journey (if any) */}
          {activeActivity && (
            <ActiveJourneyCard
              activity={activeActivity}
              visitedCount={activeVisitCount}
            />
          )}

          {/* Quick Actions */}
          <QuickActions onStartActivity={() => setShowActivityModal(true)} />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <QuickLineProgress lines={lineProgress} loading={isLoadingAny} />
              <SmartSuggestions suggestions={suggestions} loading={isLoadingAny} />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <LatestActivityCard activity={latestActivity} loading={activitiesLoading} />
              <FriendsFeed 
                activities={combinedFeed} 
                loading={feedLoading}
                hasFriends={friendsList.length > 0}
              />
            </div>
          </div>
        </div>
      </AppLayout>
      <Tutorial open={showTutorial} onComplete={handleTutorialComplete} />
      <ActivityStartModal open={showActivityModal} onOpenChange={setShowActivityModal} />
    </>
  );
};

export default Index;
