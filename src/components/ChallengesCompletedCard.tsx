import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ChallengesCompletedCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: completedChallenges = [], isLoading } = useQuery({
    queryKey: ['completed-challenges', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenge_attempts')
        .select(`
          id,
          completed_at,
          duration_minutes,
          status,
          challenges (
            id,
            name,
            challenge_type
          )
        `)
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['completed-challenges-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('challenge_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'completed');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Challenges</CardTitle>
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
            Challenges
            {totalCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {totalCount}
              </span>
            )}
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
        {completedChallenges.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-2">No challenges completed yet</p>
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
          completedChallenges.map((attempt: any) => (
            <div 
              key={attempt.id}
              className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/challenges`)}
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {attempt.challenges?.name || 'Challenge'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(attempt.completed_at), { addSuffix: true })}
                  {attempt.duration_minutes && ` • ${attempt.duration_minutes}m`}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
