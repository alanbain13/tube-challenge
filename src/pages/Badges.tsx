import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Award, Trophy, Zap, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isThisMonth } from "date-fns";

interface Badge {
  id: string;
  name: string;
  description: string;
  image_url: string;
  challenge_id: string | null;
  metro_system_id: string | null;
  badge_type: string;
}

interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  completion_time_minutes: number | null;
  rank: number | null;
  badge: Badge;
}

export default function Badges() {
  // Fetch all available badges
  const { data: allBadges } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Badge[];
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

  const earnedCount = userBadges?.length || 0;
  const totalBadges = allBadges?.length || 0;
  const availableCount = totalBadges - earnedCount;
  const completionPercentage = totalBadges ? Math.round((earnedCount / totalBadges) * 100) : 0;
  const thisMonthCount = userBadges?.filter(ub => isThisMonth(new Date(ub.earned_at))).length || 0;

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
                    <div className="text-7xl mb-4">
                      {userBadge.badge.image_url}
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
      </div>
    </AppLayout>
  );
}
