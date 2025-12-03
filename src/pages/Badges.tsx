import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Progress } from "@/components/ui/progress";
import { Award, Trophy, Zap, Target, Medal, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isThisMonth } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgeIcon } from "@/components/admin/IconPicker";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  image_url: string;
  challenge_id: string | null;
  metro_system_id: string | null;
  badge_type: string;
  criteria: {
    threshold?: number;
    zone?: string;
    line?: string;
    time_limit_minutes?: number;
  } | null;
}

interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  completion_time_minutes: number | null;
  rank: number | null;
  badge: BadgeData;
}

interface ProgressData {
  totalUniqueStations: number;
  stationsByZone: Record<string, { visited: number; total: number }>;
  stationsByLine: Record<string, { visited: number; total: number }>;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface LeaderboardEntry {
  user_id: string;
  badge_count: number;
  challenge_count: number;
  fastest_time: number | null;
  profile?: Profile;
}

export default function Badges() {
  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch friends
  const { data: friendsList } = useQuery({
    queryKey: ["friends-list", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from("friendships")
        .select("user_id_1, user_id_2")
        .eq("status", "accepted")
        .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);

      if (error) throw error;
      
      // Extract friend user IDs
      const friendIds = data.map(f => 
        f.user_id_1 === currentUser.id ? f.user_id_2 : f.user_id_1
      );
      
      return friendIds;
    },
    enabled: !!currentUser,
  });

  // Fetch friend leaderboard data
  const { data: leaderboardData } = useQuery({
    queryKey: ["friends-leaderboard", friendsList],
    queryFn: async () => {
      if (!friendsList || friendsList.length === 0) return [];

      // Include current user in the leaderboard
      const userIds = [...friendsList, currentUser?.id].filter(Boolean);

      // Fetch badge counts and fastest times
      const { data: badgeStats, error: badgeError } = await supabase
        .from("user_badges")
        .select("user_id, completion_time_minutes")
        .in("user_id", userIds);

      if (badgeError) throw badgeError;

      // Fetch challenge attempt counts
      const { data: challengeStats, error: challengeError } = await supabase
        .from("challenge_attempts")
        .select("user_id")
        .in("user_id", userIds);

      if (challengeError) throw challengeError;

      // Fetch profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      // Create profile map
      const profileMap = new Map<string, Profile>();
      profiles?.forEach(p => profileMap.set(p.user_id, p));

      // Aggregate stats by user
      const statsMap = new Map<string, LeaderboardEntry>();
      
      userIds.forEach(userId => {
        if (!userId) return;
        statsMap.set(userId, {
          user_id: userId,
          badge_count: 0,
          challenge_count: 0,
          fastest_time: null,
          profile: profileMap.get(userId),
        });
      });

      // Count badges and find fastest time
      badgeStats?.forEach(badge => {
        const entry = statsMap.get(badge.user_id);
        if (entry) {
          entry.badge_count++;
          if (badge.completion_time_minutes) {
            if (!entry.fastest_time || badge.completion_time_minutes < entry.fastest_time) {
              entry.fastest_time = badge.completion_time_minutes;
            }
          }
        }
      });

      // Count challenges
      challengeStats?.forEach(attempt => {
        const entry = statsMap.get(attempt.user_id);
        if (entry) {
          entry.challenge_count++;
        }
      });

      return Array.from(statsMap.values());
    },
    enabled: !!friendsList && friendsList.length > 0,
  });

  // Fetch all available badges with metro system info
  const { data: allBadges } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select(`
          *,
          metro_system:metro_systems(*)
        `)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch user's earned badges
  const { data: userBadges, isLoading } = useQuery({
    queryKey: ["user-badges"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_badges")
        .select(`
          *,
          badge:badges(*)
        `)
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });

      if (error) throw error;
      return data as UserBadge[];
    },
  });

  // Fetch user's progress data for badge tracking
  const { data: progressData } = useQuery({
    queryKey: ["badge-progress", currentUser?.id],
    queryFn: async (): Promise<ProgressData> => {
      if (!currentUser) throw new Error("Not authenticated");

      // Get user's verified station visits
      const { data: visits, error: visitsError } = await supabase
        .from("station_visits")
        .select("station_tfl_id")
        .eq("user_id", currentUser.id)
        .eq("status", "verified");

      if (visitsError) throw visitsError;

      const visitedStationIds = new Set(visits?.map(v => v.station_tfl_id).filter(Boolean) || []);

      // Get all stations with zone and line info
      const { data: stations, error: stationsError } = await supabase
        .from("stations")
        .select("tfl_id, zone, lines");

      if (stationsError) throw stationsError;

      // Calculate stats by zone
      const stationsByZone: Record<string, { visited: number; total: number }> = {};
      const stationsByLine: Record<string, { visited: number; total: number }> = {};

      stations?.forEach(station => {
        // Handle zones (use primary zone from "2/3" format)
        const primaryZone = station.zone?.split('/')[0];
        if (primaryZone && !isNaN(parseInt(primaryZone))) {
          if (!stationsByZone[primaryZone]) {
            stationsByZone[primaryZone] = { visited: 0, total: 0 };
          }
          stationsByZone[primaryZone].total++;
          if (visitedStationIds.has(station.tfl_id)) {
            stationsByZone[primaryZone].visited++;
          }
        }

        // Handle lines
        station.lines?.forEach((line: string) => {
          const lineLower = line.toLowerCase();
          if (!stationsByLine[lineLower]) {
            stationsByLine[lineLower] = { visited: 0, total: 0 };
          }
          stationsByLine[lineLower].total++;
          if (visitedStationIds.has(station.tfl_id)) {
            stationsByLine[lineLower].visited++;
          }
        });
      });

      return {
        totalUniqueStations: visitedStationIds.size,
        stationsByZone,
        stationsByLine,
      };
    },
    enabled: !!currentUser,
  });

  // Calculate progress for a badge
  const getBadgeProgress = (badge: BadgeData): { current: number; target: number; percentage: number } | null => {
    if (!progressData || !badge.criteria) return null;

    const { badge_type, criteria } = badge;

    if (badge_type === 'milestone' && criteria.threshold) {
      const current = progressData.totalUniqueStations;
      const target = criteria.threshold;
      return { current, target, percentage: Math.min(100, Math.round((current / target) * 100)) };
    }

    if (badge_type === 'zone' && criteria.zone) {
      const zoneData = progressData.stationsByZone[criteria.zone];
      if (!zoneData) return null;
      return { 
        current: zoneData.visited, 
        target: zoneData.total, 
        percentage: zoneData.total > 0 ? Math.round((zoneData.visited / zoneData.total) * 100) : 0 
      };
    }

    if (badge_type === 'line' && criteria.line) {
      const lineData = progressData.stationsByLine[criteria.line];
      if (!lineData) return null;
      return { 
        current: lineData.visited, 
        target: lineData.total, 
        percentage: lineData.total > 0 ? Math.round((lineData.visited / lineData.total) * 100) : 0 
      };
    }

    if (badge_type === 'timed' && criteria.threshold && criteria.time_limit_minutes) {
      // For timed badges, show the station requirement (time constraint shown in description)
      const target = criteria.threshold;
      // If zone-restricted, use zone data; otherwise use total stations
      if (criteria.zone) {
        const zoneData = progressData.stationsByZone[criteria.zone];
        if (!zoneData) return null;
        return { 
          current: zoneData.visited, 
          target, 
          percentage: Math.min(100, Math.round((zoneData.visited / target) * 100)) 
        };
      }
      return { 
        current: progressData.totalUniqueStations, 
        target, 
        percentage: Math.min(100, Math.round((progressData.totalUniqueStations / target) * 100)) 
      };
    }

    return null;
  };

  const earnedCount = userBadges?.length || 0;
  const totalBadges = allBadges?.length || 0;
  const availableCount = totalBadges - earnedCount;
  const completionPercentage = totalBadges ? Math.round((earnedCount / totalBadges) * 100) : 0;
  const thisMonthCount = userBadges?.filter(ub => isThisMonth(new Date(ub.earned_at))).length || 0;

  // Get earned badge IDs
  const earnedBadgeIds = new Set(userBadges?.map(ub => ub.badge_id) || []);
  
  // Get unearned badges grouped by badge type
  const unearnedBadges = allBadges?.filter(badge => !earnedBadgeIds.has(badge.id)) || [];
  
  const badgeTypeLabels: Record<string, string> = {
    milestone: "Milestone Badges",
    zone: "Zone Completion Badges",
    line: "Line Completion Badges",
    timed: "Timed Achievement Badges",
    challenge: "Challenge Badges",
  };
  
  const badgeTypeOrder = ["milestone", "zone", "line", "timed", "challenge"];
  
  const badgesByType = unearnedBadges.reduce((acc, badge) => {
    const type = badge.badge_type || "challenge";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(badge);
    return acc;
  }, {} as Record<string, typeof unearnedBadges>);

  // Sort leaderboard entries
  const topByBadges = [...(leaderboardData || [])]
    .sort((a, b) => b.badge_count - a.badge_count)
    .slice(0, 10);
  
  const topByChallenges = [...(leaderboardData || [])]
    .sort((a, b) => b.challenge_count - a.challenge_count)
    .slice(0, 10);
  
  const topBySpeed = [...(leaderboardData || [])]
    .filter(e => e.fastest_time !== null)
    .sort((a, b) => (a.fastest_time || Infinity) - (b.fastest_time || Infinity))
    .slice(0, 10);

  const getDisplayName = (profile?: Profile) => {
    return profile?.display_name || profile?.username || "Unknown User";
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black mb-2">Badges</h1>
          <p className="text-muted-foreground">Collect badges by completing challenges and achievements</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            icon={Award}
            label="Earned"
            value={earnedCount}
            iconColor="text-blue-500"
            loading={isLoading}
          />
          <StatCard
            icon={Target}
            label="Available"
            value={availableCount}
            iconColor="text-gray-400"
            loading={isLoading}
          />
          <StatCard
            icon={Trophy}
            label="Completion"
            value={`${completionPercentage}%`}
            iconColor="text-purple-500"
            loading={isLoading}
          />
          <StatCard
            icon={Zap}
            label="This Month"
            value={thisMonthCount}
            iconColor="text-green-500"
            loading={isLoading}
          />
        </div>

        {/* Friend Leaderboards */}
        {friendsList && friendsList.length > 0 && leaderboardData && leaderboardData.length > 0 && (
          <Card className="mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                Friend Leaderboards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="badges" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="badges">Most Badges</TabsTrigger>
                  <TabsTrigger value="challenges">Most Challenges</TabsTrigger>
                  <TabsTrigger value="speed">Fastest Times</TabsTrigger>
                </TabsList>

                <TabsContent value="badges" className="mt-6">
                  <div className="space-y-3">
                    {topByBadges.map((entry, index) => (
                      <div
                        key={entry.user_id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                            {index + 1}
                          </div>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={entry.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getDisplayName(entry.profile).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">{getDisplayName(entry.profile)}</h3>
                            {entry.user_id === currentUser?.id && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-orange-500" />
                          <span className="font-bold text-lg">{entry.badge_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="challenges" className="mt-6">
                  <div className="space-y-3">
                    {topByChallenges.map((entry, index) => (
                      <div
                        key={entry.user_id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                            {index + 1}
                          </div>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={entry.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getDisplayName(entry.profile).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">{getDisplayName(entry.profile)}</h3>
                            {entry.user_id === currentUser?.id && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-purple-500" />
                          <span className="font-bold text-lg">{entry.challenge_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="speed" className="mt-6">
                  <div className="space-y-3">
                    {topBySpeed.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No timed badges yet
                      </p>
                    ) : (
                      topBySpeed.map((entry, index) => (
                        <div
                          key={entry.user_id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                              {index + 1}
                            </div>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={entry.profile?.avatar_url || undefined} />
                              <AvatarFallback>
                                {getDisplayName(entry.profile).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold">{getDisplayName(entry.profile)}</h3>
                              {entry.user_id === currentUser?.id && (
                                <Badge variant="secondary" className="text-xs">You</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            <span className="font-bold text-lg">
                              {entry.fastest_time ? formatTime(entry.fastest_time) : "—"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Badges Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Award className="w-6 h-6 text-orange-500" />
            Your Badges
          </h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your badges...</p>
          </div>
        ) : !userBadges || userBadges.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Complete challenges to earn badges!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {userBadges.map((userBadge) => {
              return (
                <Card key={userBadge.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="pt-8 pb-6 text-center space-y-4">
                    <div className="mb-4 flex justify-center">
                      <BadgeIcon value={userBadge.badge.image_url} size="lg" />
                    </div>
                    <h3 className="font-bold text-lg">
                      {userBadge.badge.name}
                    </h3>
                    <p className="text-sm text-muted-foreground px-2">
                      {userBadge.badge.description}
                    </p>
                    {userBadge.completion_time_minutes && (
                      <p className="text-xs text-primary font-medium">
                        Completed in {Math.floor(userBadge.completion_time_minutes / 60)}h {userBadge.completion_time_minutes % 60}m
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground pt-2">
                      Earned {format(new Date(userBadge.earned_at), "MMM d, yyyy")}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Available Badges Section */}
        {Object.keys(badgesByType).length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-semibold flex items-center gap-2 mb-8">
              <Target className="w-6 h-6 text-gray-400" />
              Available Badges
            </h2>
            {badgeTypeOrder
              .filter(type => badgesByType[type]?.length > 0)
              .map((type) => (
              <div key={type} className="mb-12">
                <h3 className="text-xl font-semibold mb-6 text-muted-foreground">
                  {badgeTypeLabels[type] || type}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {badgesByType[type].map((badge) => {
                    const progress = getBadgeProgress(badge as BadgeData);
                    return (
                      <Card key={badge.id} className="overflow-hidden opacity-70 hover:opacity-90 transition-opacity">
                        <CardContent className="pt-8 pb-6 text-center space-y-4">
                          <div className="mb-4 flex justify-center opacity-50">
                            <BadgeIcon value={badge.image_url} size="lg" />
                          </div>
                          <h3 className="font-bold text-lg text-muted-foreground">
                            {badge.name}
                          </h3>
                          <p className="text-sm text-muted-foreground px-2">
                            {badge.description}
                          </p>
                          {progress && (
                            <div className="px-4 pt-2 space-y-2">
                              <Progress value={progress.percentage} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {progress.current} / {progress.target} ({progress.percentage}%)
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
