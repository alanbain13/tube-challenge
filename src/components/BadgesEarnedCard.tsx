import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Award } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function BadgesEarnedCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: earnedBadges = [], isLoading } = useQuery({
    queryKey: ['earned-badges', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          id,
          earned_at,
          badges (
            id,
            name,
            image_url,
            badge_type
          )
        `)
        .eq('user_id', user!.id)
        .order('earned_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['earned-badges-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Badges</CardTitle>
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
            <Award className="w-3.5 h-3.5" />
            Badges
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
            onClick={() => navigate('/badges')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-4">
        {earnedBadges.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-2">No badges earned yet</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-7"
              onClick={() => navigate('/badges')}
            >
              Browse Badges
            </Button>
          </div>
        ) : (
          earnedBadges.map((userBadge: any) => (
            <div 
              key={userBadge.id}
              className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate('/badges')}
            >
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden">
                {userBadge.badges?.image_url ? (
                  <img 
                    src={userBadge.badges.image_url} 
                    alt={userBadge.badges.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Award className="w-3.5 h-3.5 text-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {userBadge.badges?.name || 'Badge'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(userBadge.earned_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
