import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal, Award, MapPin, Users, Filter, MapPinCheck, Camera, Globe, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerificationLevelBadge } from "@/components/VerificationLevelBadge";
import { useNavigate } from "react-router-dom";

interface ChallengeLeaderboardEntry {
  user_id: string;
  challenge_id: string;
  challenge_name: string;
  challenge_type: string;
  duration_seconds: number | null;
  stations_visited: number | null;
  completed_at: string;
  is_personal_best: boolean | null;
  verification_level: string | null;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface BadgeLeaderboardEntry {
  user_id: string;
  badge_count: number;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface StationLeaderboardEntry {
  user_id: string;
  station_count: number;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

type VerificationFilter = "all" | "location_verified" | "photo_verified" | "remote_verified";

const VERIFICATION_FILTERS: { value: VerificationFilter; label: string }[] = [
  { value: "all", label: "All Levels" },
  { value: "location_verified", label: "Location Only" },
  { value: "photo_verified", label: "Photo+" },
  { value: "remote_verified", label: "Remote+" },
];

export default function Leaderboards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("challenges");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [selectedChallenge, setSelectedChallenge] = useState<string>("all");

  // Fetch all challenges
  const { data: challenges = [] } = useQuery({
    queryKey: ["leaderboard-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("id, name, challenge_type, ranking_metric, required_verification")
        .eq("is_official", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch challenge leaderboard data
  const { data: challengeLeaderboardData = [], isLoading: isLoadingChallenges } = useQuery({
    queryKey: ["global-challenge-leaderboard", selectedChallenge, verificationFilter],
    queryFn: async () => {
      let query = supabase
        .from("challenge_attempts")
        .select(`
          user_id,
          challenge_id,
          duration_seconds,
          stations_visited,
          completed_at,
          is_personal_best,
          challenges!inner(name, challenge_type, ranking_metric, required_verification)
        `)
        .eq("status", "completed")
        .eq("is_personal_best", true);

      if (selectedChallenge !== "all") {
        query = query.eq("challenge_id", selectedChallenge);
      }

      const { data: attempts, error } = await query.order("duration_seconds", { ascending: true });
      if (error) throw error;

      const attemptIds = attempts?.map(a => a.challenge_id) || [];
      const userIds = [...new Set(attempts?.map(a => a.user_id) || [])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const { data: activities } = await supabase
        .from("activities")
        .select("challenge_id, user_id, verification_level")
        .in("challenge_id", attemptIds);

      const verificationMap = new Map(
        activities?.map(a => [`${a.challenge_id}-${a.user_id}`, a.verification_level]) || []
      );

      return attempts?.map(a => ({
        user_id: a.user_id,
        challenge_id: a.challenge_id,
        challenge_name: (a.challenges as any)?.name,
        challenge_type: (a.challenges as any)?.challenge_type,
        duration_seconds: a.duration_seconds,
        stations_visited: a.stations_visited,
        completed_at: a.completed_at,
        is_personal_best: a.is_personal_best,
        verification_level: verificationMap.get(`${a.challenge_id}-${a.user_id}`) || "remote_verified",
        profile: profileMap.get(a.user_id),
      })) as ChallengeLeaderboardEntry[];
    },
    enabled: activeTab === "challenges",
  });

  // Fetch badge leaderboard data
  const { data: badgeLeaderboardData = [], isLoading: isLoadingBadges } = useQuery({
    queryKey: ["global-badge-leaderboard"],
    queryFn: async () => {
      const { data: badgeCounts, error } = await supabase
        .from("user_badges")
        .select("user_id");

      if (error) throw error;

      // Count badges per user
      const countMap = new Map<string, number>();
      badgeCounts?.forEach(b => {
        countMap.set(b.user_id, (countMap.get(b.user_id) || 0) + 1);
      });

      const userIds = [...countMap.keys()];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const entries: BadgeLeaderboardEntry[] = userIds.map(userId => ({
        user_id: userId,
        badge_count: countMap.get(userId) || 0,
        profile: profileMap.get(userId),
      }));

      return entries.sort((a, b) => b.badge_count - a.badge_count).slice(0, 50);
    },
    enabled: activeTab === "badges",
  });

  // Fetch station count leaderboard data
  const { data: stationLeaderboardData = [], isLoading: isLoadingStations } = useQuery({
    queryKey: ["global-station-leaderboard", verificationFilter],
    queryFn: async () => {
      let query = supabase
        .from("station_visits")
        .select("user_id, station_tfl_id, verification_status")
        .eq("status", "verified");

      // Apply verification filter
      if (verificationFilter === "location_verified") {
        query = query.eq("verification_status", "location_verified");
      } else if (verificationFilter === "photo_verified") {
        query = query.in("verification_status", ["location_verified", "photo_verified"]);
      }

      const { data: visits, error } = await query;
      if (error) throw error;

      // Count unique stations per user
      const userStationMap = new Map<string, Set<string>>();
      visits?.forEach(v => {
        if (!v.station_tfl_id) return;
        if (!userStationMap.has(v.user_id)) {
          userStationMap.set(v.user_id, new Set());
        }
        userStationMap.get(v.user_id)!.add(v.station_tfl_id);
      });

      const userIds = [...userStationMap.keys()];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const entries: StationLeaderboardEntry[] = userIds.map(userId => ({
        user_id: userId,
        station_count: userStationMap.get(userId)?.size || 0,
        profile: profileMap.get(userId),
      }));

      return entries.sort((a, b) => b.station_count - a.station_count).slice(0, 50);
    },
    enabled: activeTab === "stations",
  });

  // Filter challenge data by verification level
  const filteredChallengeData = challengeLeaderboardData.filter(entry => {
    if (verificationFilter === "all") return true;
    if (verificationFilter === "location_verified") {
      return entry.verification_level === "location_verified";
    }
    if (verificationFilter === "photo_verified") {
      return entry.verification_level === "location_verified" || 
             entry.verification_level === "photo_verified";
    }
    return true;
  });

  // Group challenges by challenge for display
  const groupedByChallenge = filteredChallengeData.reduce((acc, entry) => {
    if (!acc[entry.challenge_id]) {
      acc[entry.challenge_id] = {
        name: entry.challenge_name,
        type: entry.challenge_type,
        entries: [],
      };
    }
    acc[entry.challenge_id].entries.push(entry);
    return acc;
  }, {} as Record<string, { name: string; type: string; entries: ChallengeLeaderboardEntry[] }>);

  const getDisplayName = (profile?: { display_name: string | null; username: string | null }) => {
    return profile?.display_name || profile?.username || "Anonymous";
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-medium">{index + 1}</span>;
  };

  const isLoading = activeTab === "challenges" ? isLoadingChallenges : 
                    activeTab === "badges" ? isLoadingBadges : isLoadingStations;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black mb-2">Leaderboards</h1>
          <p className="text-muted-foreground">Global rankings across challenges, badges, and stations</p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="challenges" className="gap-2">
              <Trophy className="w-4 h-4" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="badges" className="gap-2">
              <Award className="w-4 h-4" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="stations" className="gap-2">
              <MapPin className="w-4 h-4" />
              Stations
            </TabsTrigger>
          </TabsList>

          {/* Challenges Tab */}
          <TabsContent value="challenges">
            {/* Challenge Filters */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Challenge</label>
                    <Select value={selectedChallenge} onValueChange={setSelectedChallenge}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Challenges" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Challenges</SelectItem>
                        {challenges.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Shield className="w-4 h-4" />
                      <span>Verification Level</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={verificationFilter === "all" ? "default" : "outline"}
                        onClick={() => setVerificationFilter("all")}
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={verificationFilter === "location_verified" ? "default" : "outline"}
                        onClick={() => setVerificationFilter("location_verified")}
                        className="gap-1"
                      >
                        <MapPinCheck className="w-3 h-3" />
                        Location Only
                      </Button>
                      <Button
                        size="sm"
                        variant={verificationFilter === "photo_verified" ? "default" : "outline"}
                        onClick={() => setVerificationFilter("photo_verified")}
                        className="gap-1"
                      >
                        <Camera className="w-3 h-3" />
                        Photo+
                      </Button>
                      <Button
                        size="sm"
                        variant={verificationFilter === "remote_verified" ? "default" : "outline"}
                        onClick={() => setVerificationFilter("remote_verified")}
                        className="gap-1"
                      >
                        <Globe className="w-3 h-3" />
                        Remote+
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Challenge Leaderboard Content */}
            {isLoadingChallenges ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Loading leaderboards...</p>
                </CardContent>
              </Card>
            ) : filteredChallengeData.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No leaderboard entries found for the selected filters.</p>
                </CardContent>
              </Card>
            ) : selectedChallenge === "all" ? (
              <div className="space-y-6">
                {Object.entries(groupedByChallenge).map(([challengeId, { name, type, entries }]) => (
                  <Card key={challengeId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{name}</CardTitle>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/challenges/${challengeId}/leaderboard`)}
                        >
                          View Full
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {entries.slice(0, 5).map((entry, index) => (
                          <div
                            key={`${entry.user_id}-${entry.challenge_id}`}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              entry.user_id === user?.id ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {getRankIcon(index)}
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={entry.profile?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getDisplayName(entry.profile).charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{getDisplayName(entry.profile)}</p>
                                {entry.user_id === user?.id && (
                                  <Badge variant="secondary" className="text-xs">You</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <VerificationLevelBadge 
                                level={entry.verification_level} 
                                compact 
                                showTooltip={false}
                              />
                              <div className="text-right">
                                <p className="font-mono text-sm font-medium">
                                  {type === "timed" 
                                    ? `${entry.stations_visited} stations`
                                    : formatDuration(entry.duration_seconds)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    {challenges.find(c => c.id === selectedChallenge)?.name || "Challenge"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {filteredChallengeData.map((entry, index) => (
                      <div
                        key={`${entry.user_id}-${entry.challenge_id}`}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          entry.user_id === user?.id ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {getRankIcon(index)}
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={entry.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getDisplayName(entry.profile).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{getDisplayName(entry.profile)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.completed_at).toLocaleDateString()}
                            </p>
                            {entry.user_id === user?.id && (
                              <Badge variant="secondary" className="text-xs mt-1">You</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <VerificationLevelBadge level={entry.verification_level} compact />
                          <div className="text-right">
                            <p className="font-mono text-lg font-medium">
                              {entry.challenge_type === "timed" 
                                ? `${entry.stations_visited} stations`
                                : formatDuration(entry.duration_seconds)}
                            </p>
                            {entry.stations_visited && entry.challenge_type !== "timed" && (
                              <p className="text-xs text-muted-foreground">
                                {entry.stations_visited} stations
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Badges Tab */}
          <TabsContent value="badges">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-6 h-6 text-orange-500" />
                  Most Badges Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingBadges ? (
                  <div className="p-12 text-center">
                    <p className="text-muted-foreground">Loading badge leaderboard...</p>
                  </div>
                ) : badgeLeaderboardData.length === 0 ? (
                  <div className="p-12 text-center">
                    <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No badge data available yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {badgeLeaderboardData.map((entry, index) => (
                      <div
                        key={entry.user_id}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          entry.user_id === user?.id ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {getRankIcon(index)}
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={entry.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getDisplayName(entry.profile).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{getDisplayName(entry.profile)}</p>
                            {entry.user_id === user?.id && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-orange-500" />
                          <span className="font-mono text-lg font-bold">{entry.badge_count}</span>
                          <span className="text-muted-foreground text-sm">badges</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stations Tab */}
          <TabsContent value="stations">
            {/* Station Verification Filter */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    <span>Filter by Verification:</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={verificationFilter === "all" ? "default" : "outline"}
                      onClick={() => setVerificationFilter("all")}
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant={verificationFilter === "location_verified" ? "default" : "outline"}
                      onClick={() => setVerificationFilter("location_verified")}
                      className="gap-1"
                    >
                      <MapPinCheck className="w-3 h-3" />
                      Location Only
                    </Button>
                    <Button
                      size="sm"
                      variant={verificationFilter === "photo_verified" ? "default" : "outline"}
                      onClick={() => setVerificationFilter("photo_verified")}
                      className="gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      Photo+
                    </Button>
                    <Button
                      size="sm"
                      variant={verificationFilter === "remote_verified" ? "default" : "outline"}
                      onClick={() => setVerificationFilter("remote_verified")}
                      className="gap-1"
                    >
                      <Globe className="w-3 h-3" />
                      Remote+
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-blue-500" />
                  Most Stations Visited
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingStations ? (
                  <div className="p-12 text-center">
                    <p className="text-muted-foreground">Loading station leaderboard...</p>
                  </div>
                ) : stationLeaderboardData.length === 0 ? (
                  <div className="p-12 text-center">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No station visit data available yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stationLeaderboardData.map((entry, index) => (
                      <div
                        key={entry.user_id}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          entry.user_id === user?.id ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {getRankIcon(index)}
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={entry.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getDisplayName(entry.profile).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{getDisplayName(entry.profile)}</p>
                            {entry.user_id === user?.id && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-blue-500" />
                          <span className="font-mono text-lg font-bold">{entry.station_count}</span>
                          <span className="text-muted-foreground text-sm">/ 272</span>
                          <span className="text-muted-foreground text-sm">
                            ({Math.round((entry.station_count / 272) * 100)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}