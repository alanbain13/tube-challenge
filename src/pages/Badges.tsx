import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Award, Trophy, Zap, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isThisMonth } from "date-fns";

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

  const { data: totalChallenges } = useQuery({
    queryKey: ["total-challenges"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("challenges")
        .select("*", { count: "exact", head: true })
        .eq("is_official", true);

      if (error) throw error;
      return count || 0;
    },
  });

  const earnedCount = achievements?.length || 0;
  const availableCount = (totalChallenges || 0) - earnedCount;
  const completionPercentage = totalChallenges ? Math.round((earnedCount / totalChallenges) * 100) : 0;
  const thisMonthCount = achievements?.filter(a => isThisMonth(new Date(a.earned_at))).length || 0;

  const getBadgeEmoji = (challengeName: string) => {
    const name = challengeName.toLowerCase();
    if (name.includes("all lines") || name.includes("complete all")) return "🏆";
    if (name.includes("circle")) return "🥇";
    if (name.includes("speed") || name.includes("fast")) return "⚡";
    if (name.includes("district")) return "🎯";
    if (name.includes("northern")) return "⭐";
    return "🏅";
  };

  const getBadgeDescription = (challengeName: string) => {
    const name = challengeName.toLowerCase();
    if (name.includes("all lines")) return "Completed all London Underground stations";
    if (name.includes("circle")) return "Completed the Circle Line challenge";
    return `Completed the ${challengeName}`;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Badges</h1>
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
        ) : !achievements || achievements.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Complete challenges to earn badges!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {achievements.map((achievement) => {
              const relatedAttempt = challengeAttempts?.find(
                (attempt) => attempt.challenge_id === achievement.meta?.challenge_id
              );
              const emoji = getBadgeEmoji(achievement.name);
              const description = getBadgeDescription(achievement.name);

              return (
                <Card key={achievement.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="pt-8 pb-6 text-center space-y-4">
                    <div className="text-7xl mb-4">
                      {emoji}
                    </div>
                    <h3 className="font-bold text-lg">
                      {achievement.name}
                    </h3>
                    <p className="text-sm text-muted-foreground px-2">
                      {description}
                    </p>
                    <p className="text-xs text-muted-foreground pt-2">
                      Earned {format(new Date(achievement.earned_at), "MMM d, yyyy")}
                    </p>
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
