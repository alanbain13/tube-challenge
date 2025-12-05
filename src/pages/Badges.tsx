import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Progress } from "@/components/ui/progress";
import { Award, Trophy, Zap, Target, Medal, TrendingUp, MapPinCheck, Camera, Globe, Filter, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isThisMonth } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { BadgeIcon } from "@/components/admin/IconPicker";
import { VerificationLevelBadge } from "@/components/VerificationLevelBadge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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
    required_verification?: string;
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
  const [verificationFilter, setVerificationFilter] = useState<string | null>(null);

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
  
  // Filter function for verification level
  const matchesVerificationFilter = (criteria: BadgeData['criteria']) => {
    if (!verificationFilter) return true;
    const badgeVerification = criteria?.required_verification || 'remote_verified';
    
    if (verificationFilter === 'location_verified') {
      return badgeVerification === 'location_verified';
    }
    if (verificationFilter === 'photo_verified') {
      return badgeVerification === 'location_verified' || badgeVerification === 'photo_verified';
    }
    // remote_verified shows all
    return true;
  };
  
  // Filter earned badges
  const filteredUserBadges = userBadges?.filter(ub => 
    matchesVerificationFilter(ub.badge.criteria)
  ) || [];
  
  // Get unearned badges grouped by badge type (with filter)
  const unearnedBadges = allBadges?.filter(badge => 
    !earnedBadgeIds.has(badge.id) && matchesVerificationFilter(badge.criteria as BadgeData['criteria'])
  ) || [];
  
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

  // Sort leaderboard entries for compact preview
  const topByBadges = [...(leaderboardData || [])]
    .sort((a, b) => b.badge_count - a.badge_count)
    .slice(0, 10);

  const getDisplayName = (profile?: Profile) => {
    return profile?.display_name || profile?.username || "Unknown User";
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

        {/* Friends Preview - Compact */}
        {friendsList && friendsList.length > 0 && leaderboardData && leaderboardData.length > 0 && (
          <Card className="mb-12">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-blue-500" />
                  Friends Activity
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/leaderboards'}
                >
                  View Global Leaderboards →
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Badges Row */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Award className="w-4 h-4" /> Most Badges
                </p>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {topByBadges.slice(0, 3).map((entry, index) => (
                    <div
                      key={entry.user_id}
                      className="flex items-center gap-3 p-3 border rounded-lg min-w-[200px] bg-muted/30"
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {index + 1}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={entry.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getDisplayName(entry.profile).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{getDisplayName(entry.profile)}</p>
                        <p className="text-xs text-muted-foreground">{entry.badge_count} badges</p>
                      </div>
                      {entry.user_id === currentUser?.id && (
                        <Badge variant="secondary" className="text-xs shrink-0">You</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Filter */}
        <Card className="mb-8">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="w-4 h-4" />
                <span>Filter by Verification:</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={!verificationFilter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVerificationFilter(null)}
                >
                  All
                </Button>
                <Button
                  variant={verificationFilter === 'location_verified' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVerificationFilter('location_verified')}
                  className="gap-1"
                >
                  <MapPinCheck className="w-3 h-3" />
                  Location Only
                </Button>
                <Button
                  variant={verificationFilter === 'photo_verified' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVerificationFilter('photo_verified')}
                  className="gap-1"
                >
                  <Camera className="w-3 h-3" />
                  Photo+
                </Button>
                <Button
                  variant={verificationFilter === 'remote_verified' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVerificationFilter('remote_verified')}
                  className="gap-1"
                >
                  <Globe className="w-3 h-3" />
                  Remote+
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Badges Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Award className="w-6 h-6 text-orange-500" />
            Your Badges
            {verificationFilter && (
              <Badge variant="secondary" className="text-xs ml-2">
                {filteredUserBadges.length} shown
              </Badge>
            )}
          </h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your badges...</p>
          </div>
        ) : filteredUserBadges.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {verificationFilter 
                  ? "No badges match this verification filter" 
                  : "Complete challenges to earn badges!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredUserBadges.map((userBadge) => {
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
                    {userBadge.badge.criteria?.required_verification && (
                      <div className="flex justify-center">
                        <VerificationLevelBadge 
                          level={userBadge.badge.criteria.required_verification} 
                          compact 
                          showTooltip 
                        />
                      </div>
                    )}
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
                          {(badge.criteria as BadgeData['criteria'])?.required_verification && (
                            <div className="flex justify-center">
                              <VerificationLevelBadge 
                                level={(badge.criteria as BadgeData['criteria'])?.required_verification} 
                                compact 
                                showTooltip 
                              />
                            </div>
                          )}
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
