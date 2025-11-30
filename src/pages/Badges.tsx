import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Trophy, Clock, Medal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Achievement {
  id: string;
  name: string;
  key: string;
  type: string;
  earned_at: string;
  meta: any;
}

interface ChallengeAttempt {
  duration_minutes: number;
  completed_at: string;
  challenge_id: string;
  challenge: {
    name: string;
    challenge_type: string;
  };
}

export default function Badges() {
  const { data: achievements, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });

      if (error) throw error;
      return data as Achievement[];
    },
  });

  const { data: challengeAttempts } = useQuery({
    queryKey: ["challenge-attempts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("challenge_attempts")
        .select(`
          *,
          challenge:challenges(name, challenge_type)
        `)
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (error) throw error;
      return data as ChallengeAttempt[];
    },
  });

  const getRanking = async (challengeId: string, duration: number) => {
    const { data, error } = await supabase
      .from("challenge_attempts")
      .select("duration_minutes")
      .eq("challenge_id", challengeId)
      .order("duration_minutes", { ascending: true });

    if (error || !data) return null;
    
    const rank = data.findIndex(attempt => attempt.duration_minutes === duration) + 1;
    return { rank, total: data.length };
  };

  const getBadgeIcon = (type: string) => {
    switch (type) {
      case "challenge_complete":
        return Trophy;
      case "speed_record":
        return Medal;
      default:
        return Award;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Badges</h1>
          <p className="text-muted-foreground">Your earned achievements and completed challenges</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your badges...</p>
          </div>
        ) : !achievements || achievements.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Complete challenges to earn badges!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements.map((achievement) => {
              const Icon = getBadgeIcon(achievement.type);
              const relatedAttempt = challengeAttempts?.find(
                (attempt) => attempt.challenge_id === achievement.meta?.challenge_id
              );

              return (
                <Card key={achievement.id} className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/10 pb-8">
                    <div className="flex justify-center mb-4">
                      <div className="p-6 rounded-full bg-background shadow-lg">
                        <Icon className="w-12 h-12 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-center text-xl">
                      {achievement.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {relatedAttempt && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Challenge:</span>
                          <span className="font-medium">{relatedAttempt.challenge.name}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Time:
                          </span>
                          <span className="font-medium">
                            {formatDuration(relatedAttempt.duration_minutes)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Earned:</span>
                      <span className="font-medium">
                        {format(new Date(achievement.earned_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    {achievement.type === "challenge_complete" && (
                      <div className="pt-2">
                        <Badge variant="secondary" className="w-full justify-center">
                          <Trophy className="w-3 h-3 mr-1" />
                          Challenge Complete
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
