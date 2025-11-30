import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, Clock, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  challenge_type: string;
  station_tfl_ids: string[];
  estimated_duration_minutes: number | null;
  is_official: boolean;
  metro_system_id: string;
}

interface ChallengeAttempt {
  id: string;
  duration_minutes: number;
  completed_at: string;
  user_id: string;
}

export default function Challenges() {
  const navigate = useNavigate();

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

  const getChallengeAttempts = (challengeId: string) => {
    return useQuery({
      queryKey: ["challenge-attempts", challengeId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("challenge_attempts")
          .select("*")
          .eq("challenge_id", challengeId)
          .order("duration_minutes", { ascending: true })
          .limit(10);

        if (error) throw error;
        return data as ChallengeAttempt[];
      },
    });
  };

  const handleStartChallenge = (challenge: Challenge) => {
    toast.info("Challenge start feature coming soon!");
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Challenges</h1>
          <p className="text-muted-foreground">Test yourself with official and community challenges</p>
        </div>

        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading challenges...</p>
              </div>
            ) : challenges.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No challenges available yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {challenges.map((challenge) => {
                  const attemptCount = 0; // TODO: Get from attempts query
                  const bestTime = null; // TODO: Get from attempts query
                  
                  return (
                    <Card key={challenge.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-2xl mb-2">{challenge.name}</CardTitle>
                            <CardDescription>{challenge.description}</CardDescription>
                          </div>
                          <Badge variant="secondary">{challenge.challenge_type}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="text-muted-foreground">Stations</p>
                              <p className="font-semibold">{challenge.station_tfl_ids.length}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="text-muted-foreground">Attempts</p>
                              <p className="font-semibold">{attemptCount}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="text-muted-foreground">Est. Time</p>
                              <p className="font-semibold">{formatDuration(challenge.estimated_duration_minutes)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={() => handleStartChallenge(challenge)}>
                            Start Challenge
                          </Button>
                          <Button variant="outline">Leaderboard</Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No completed challenges yet. Start your first challenge!</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
