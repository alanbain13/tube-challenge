import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Medal } from "lucide-react";

export function LeaderboardPositionsCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get user's best challenge attempts with their ranks
  const { data: bestAttempts = [], isLoading } = useQuery({
    queryKey: ['user-best-attempts', user?.id],
    queryFn: async () => {
      // Get user's completed challenge attempts marked as personal best
      const { data: attempts, error: attemptsError } = await supabase
        .from('challenge_attempts')
        .select(`
          id,
          challenge_id,
          duration_minutes,
          stations_visited,
          is_personal_best,
          challenges (
            id,
            name,
            challenge_type,
            ranking_metric
          )
        `)
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .eq('is_personal_best', true)
        .order('completed_at', { ascending: false })
        .limit(10);
      
      if (attemptsError) throw attemptsError;
      if (!attempts || attempts.length === 0) return [];

      // For each attempt, calculate rank by counting better attempts
      const rankedAttempts = await Promise.all(
        attempts.map(async (attempt: any) => {
          const challenge = attempt.challenges;
          if (!challenge) return null;

          // Get count of better personal-best attempts for this challenge
          let rankQuery = supabase
            .from('challenge_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('challenge_id', attempt.challenge_id)
            .eq('status', 'completed')
            .eq('is_personal_best', true);

          // Ranking depends on metric
          if (challenge.ranking_metric === 'stations' || challenge.challenge_type === 'timed') {
            // Higher stations is better
            rankQuery = rankQuery.gt('stations_visited', attempt.stations_visited || 0);
          } else {
            // Lower time is better
            rankQuery = rankQuery.lt('duration_minutes', attempt.duration_minutes);
          }

          const { count } = await rankQuery;
          const rank = (count || 0) + 1;

          return {
            ...attempt,
            rank,
            challengeName: challenge.name,
            challengeType: challenge.challenge_type,
          };
        })
      );

      return rankedAttempts
        .filter(Boolean)
        .sort((a, b) => a!.rank - b!.rank)
        .slice(0, 3);
    },
    enabled: !!user,
  });

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: 'text-yellow-500', label: '1st' };
    if (rank === 2) return { icon: Medal, color: 'text-gray-400', label: '2nd' };
    if (rank === 3) return { icon: Medal, color: 'text-amber-600', label: '3rd' };
    return { icon: Medal, color: 'text-muted-foreground', label: `#${rank}` };
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Leaderboards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          {[1, 2].map(i => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" />
            Leaderboard Positions
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/challenges')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-4">
        {bestAttempts.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-2">Complete challenges to appear on leaderboards</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-7"
              onClick={() => navigate('/challenges')}
            >
              Browse Challenges
            </Button>
          </div>
        ) : (
          bestAttempts.map((attempt: any) => {
            const { icon: RankIcon, color, label } = getRankDisplay(attempt.rank);
            return (
              <div 
                key={attempt.id}
                className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/challenges/${attempt.challenge_id}/leaderboard`)}
              >
                <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center ${color}`}>
                  <RankIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {attempt.challengeName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {label} place
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
