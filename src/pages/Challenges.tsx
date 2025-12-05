import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, Clock, MapPin, Route, Timer, Hash, Navigation, Shield, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { VerificationLevelBadge } from "@/components/VerificationLevelBadge";
import { CHALLENGE_TYPE_CONFIG } from "@/lib/challengeVerification";

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  challenge_type: string;
  station_tfl_ids: string[];
  estimated_duration_minutes: number | null;
  is_official: boolean;
  metro_system_id: string;
  is_sequenced: boolean | null;
  start_station_tfl_id: string | null;
  end_station_tfl_id: string | null;
  time_limit_seconds: number | null;
  target_station_count: number | null;
  ranking_metric: string | null;
  required_verification: string | null;
}

interface ChallengeAttempt {
  id: string;
  challenge_id: string;
  user_id: string;
  status: string;
  started_at: string | null;
  completed_at: string;
  duration_seconds: number | null;
  stations_visited: number | null;
  is_personal_best: boolean | null;
}

type VerificationFilter = "all" | "location_verified" | "photo_verified" | "remote_verified";

const ICON_MAP: Record<string, typeof Trophy> = {
  sequenced_route: Route,
  unsequenced_route: MapPin,
  timed: Timer,
  station_count: Hash,
  point_to_point: Navigation,
};

export default function Challenges() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");

  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("is_official", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Challenge[];
    },
  });

  const { data: userAttempts = [] } = useQuery({
    queryKey: ["user-challenge-attempts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("challenge_attempts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ChallengeAttempt[];
    },
    enabled: !!user?.id,
  });

  const { data: attemptCounts = {} } = useQuery({
    queryKey: ["challenge-attempt-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_attempts")
        .select("challenge_id, status");

      if (error) throw error;
      
      const counts: Record<string, { total: number; completed: number }> = {};
      data.forEach((attempt) => {
        if (!counts[attempt.challenge_id]) {
          counts[attempt.challenge_id] = { total: 0, completed: 0 };
        }
        counts[attempt.challenge_id].total++;
        if (attempt.status === "completed") {
          counts[attempt.challenge_id].completed++;
        }
      });
      return counts;
    },
  });

  const handleStartChallenge = async (challenge: Challenge) => {
    if (!user?.id) {
      toast.error("Please sign in to start a challenge");
      return;
    }

    try {
      // Check for active attempts on this challenge
      const { data: activeAttempts } = await supabase
        .from("challenge_attempts")
        .select("id")
        .eq("user_id", user.id)
        .eq("challenge_id", challenge.id)
        .eq("status", "active")
        .limit(1);

      if (activeAttempts && activeAttempts.length > 0) {
        toast.error("You already have an active attempt for this challenge");
        return;
      }

      // Determine activity type based on challenge type
      const activityType = challenge.challenge_type === "timed" || challenge.challenge_type === "station_count"
        ? "open"
        : "route";

      // Create activity FIRST (activity_id is required on challenge_attempts)
      const { data: activity, error: activityError } = await supabase
        .from("activities")
        .insert({
          user_id: user.id,
          title: `Challenge: ${challenge.name}`,
          activity_type: activityType,
          status: "active",
          station_tfl_ids: challenge.station_tfl_ids || [],
          start_station_tfl_id: challenge.start_station_tfl_id,
          end_station_tfl_id: challenge.end_station_tfl_id,
          // New challenge columns - cast needed until types regenerated
          ...({ 
            challenge_id: challenge.id,
            challenge_target_station_count: challenge.target_station_count,
          } as Record<string, unknown>),
        } as any)
        .select()
        .single();

      if (activityError) throw activityError;

      // Create challenge attempt with activity_id
      const { data: attempt, error: attemptError } = await supabase
        .from("challenge_attempts")
        .insert({
          challenge_id: challenge.id,
          user_id: user.id,
          activity_id: activity.id,
          duration_minutes: 0, // placeholder, will be updated on completion
          completed_at: new Date().toISOString(), // placeholder, will be updated on completion
          status: "active",
          stations_visited: 0,
        } as any)
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Update activity with attempt_id
      await supabase
        .from("activities")
        .update({ challenge_attempt_id: attempt.id } as any)
        .eq("id", activity.id);

      // Create activity_plan_item records for the challenge stations
      // This marks the activity as "planned" so the map shows target stations
      if (challenge.station_tfl_ids && challenge.station_tfl_ids.length > 0) {
        const planItems = challenge.station_tfl_ids.map((stationId, index) => ({
          activity_id: activity.id,
          station_tfl_id: stationId,
          seq_planned: index + 1, // Sequence matters for sequenced challenges, arbitrary for unsequenced
        }));

        const { error: planError } = await supabase
          .from("activity_plan_item")
          .insert(planItems);

        if (planError) {
          console.error("Error creating plan items:", planError);
          // Don't fail the whole operation, just log the error
        }
      }

      toast.success("Challenge started!");
      navigate(`/activities/${activity.id}/checkin`);
    } catch (error) {
      console.error("Error starting challenge:", error);
      toast.error("Failed to start challenge");
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTimeLimit = (seconds: number | null) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins > 0 ? `${mins}m` : ""}`;
    return `${mins}m`;
  };

  const getChallengeTypeConfig = (type: string) => {
    const config = CHALLENGE_TYPE_CONFIG[type] || { label: type, color: "bg-muted" };
    const icon = ICON_MAP[type] || Trophy;
    return { ...config, icon };
  };

  // Filter challenges by verification level
  const filteredChallenges = challenges.filter(c => {
    if (verificationFilter === "all") return true;
    const reqLevel = c.required_verification || "remote_verified";
    if (verificationFilter === "location_verified") return reqLevel === "location_verified";
    if (verificationFilter === "photo_verified") return reqLevel === "location_verified" || reqLevel === "photo_verified";
    return true;
  });

  const completedChallengeIds = new Set(
    userAttempts.filter((a) => a.status === "completed").map((a) => a.challenge_id)
  );

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black mb-2">Challenges</h1>
          <p className="text-muted-foreground">Test yourself with official and community challenges</p>
        </div>

        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-6">
            {/* Verification Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="text-sm text-muted-foreground mr-2 flex items-center"><Filter className="w-4 h-4 mr-1" />Filter:</span>
              <Button size="sm" variant={verificationFilter === "all" ? "default" : "outline"} onClick={() => setVerificationFilter("all")}>All</Button>
              <Button size="sm" variant={verificationFilter === "location_verified" ? "default" : "outline"} onClick={() => setVerificationFilter("location_verified")}>Location Only</Button>
              <Button size="sm" variant={verificationFilter === "photo_verified" ? "default" : "outline"} onClick={() => setVerificationFilter("photo_verified")}>Photo+</Button>
              <Button size="sm" variant={verificationFilter === "remote_verified" ? "default" : "outline"} onClick={() => setVerificationFilter("remote_verified")}>Remote+</Button>
            </div>
            
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading challenges...</p>
              </div>
            ) : filteredChallenges.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No challenges available for the selected filter.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {filteredChallenges.map((challenge) => {
                  const typeConfig = getChallengeTypeConfig(challenge.challenge_type);
                  const TypeIcon = typeConfig.icon;
                  const counts = attemptCounts[challenge.id] || { total: 0, completed: 0 };
                  const isCompleted = completedChallengeIds.has(challenge.id);

                  return (
                    <Card key={challenge.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={`${typeConfig.color} text-white`}>
                                <TypeIcon className="w-3 h-3 mr-1" />
                                {typeConfig.label}
                              </Badge>
                              {isCompleted && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Completed
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-2xl mb-2">{challenge.name}</CardTitle>
                            <CardDescription>{challenge.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          {challenge.station_tfl_ids?.length > 0 && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <div className="text-sm">
                                <p className="text-muted-foreground">Stations</p>
                                <p className="font-semibold">{challenge.station_tfl_ids.length}</p>
                              </div>
                            </div>
                          )}
                          {challenge.time_limit_seconds && (
                            <div className="flex items-center gap-2">
                              <Timer className="w-4 h-4 text-muted-foreground" />
                              <div className="text-sm">
                                <p className="text-muted-foreground">Time Limit</p>
                                <p className="font-semibold">{formatTimeLimit(challenge.time_limit_seconds)}</p>
                              </div>
                            </div>
                          )}
                          {challenge.target_station_count && (
                            <div className="flex items-center gap-2">
                              <Hash className="w-4 h-4 text-muted-foreground" />
                              <div className="text-sm">
                                <p className="text-muted-foreground">Target</p>
                                <p className="font-semibold">{challenge.target_station_count} stations</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="text-muted-foreground">Attempts</p>
                              <p className="font-semibold">{counts.total}</p>
                            </div>
                          </div>
                          {challenge.estimated_duration_minutes && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <div className="text-sm">
                                <p className="text-muted-foreground">Est. Time</p>
                                <p className="font-semibold">{formatDuration(challenge.estimated_duration_minutes)}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="text-muted-foreground">Verification</p>
                              <VerificationLevelBadge 
                                level={challenge.required_verification} 
                                compact 
                                showIcon={false}
                                showTooltip={false}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={() => handleStartChallenge(challenge)}>
                            {isCompleted ? "Try Again" : "Start Challenge"}
                          </Button>
                          <Button variant="outline" onClick={() => navigate(`/challenges/${challenge.id}/leaderboard`)}>
                            Leaderboard
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {userAttempts.filter((a) => a.status === "completed").length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No completed challenges yet. Start your first challenge!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {userAttempts
                  .filter((a) => a.status === "completed")
                  .map((attempt) => {
                    const challenge = challenges.find((c) => c.id === attempt.challenge_id);
                    if (!challenge) return null;
                    const typeConfig = getChallengeTypeConfig(challenge.challenge_type);

                    return (
                      <Card key={attempt.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={`${typeConfig.color} text-white text-xs`}>
                                  {typeConfig.label}
                                </Badge>
                                <VerificationLevelBadge 
                                  level={challenge.required_verification} 
                                  compact 
                                  showIcon
                                  showTooltip={false}
                                />
                                {attempt.is_personal_best && (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
                                    Personal Best
                                  </Badge>
                                )}
                              </div>
                              <p className="font-semibold">{challenge.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(attempt.completed_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              {attempt.duration_seconds && (
                                <p className="font-mono text-lg">
                                  {Math.floor(attempt.duration_seconds / 60)}m {attempt.duration_seconds % 60}s
                                </p>
                              )}
                              {attempt.stations_visited && (
                                <p className="text-sm text-muted-foreground">
                                  {attempt.stations_visited} stations
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
