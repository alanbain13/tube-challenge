import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Route, MapPin, Timer, Hash, Navigation, Trophy } from "lucide-react";

const CHALLENGE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Trophy; color: string }> = {
  sequenced_route: { label: "Sequenced Route", icon: Route, color: "bg-blue-500" },
  unsequenced_route: { label: "Any Order", icon: MapPin, color: "bg-green-500" },
  timed: { label: "Timed", icon: Timer, color: "bg-orange-500" },
  station_count: { label: "Station Count", icon: Hash, color: "bg-purple-500" },
  point_to_point: { label: "Point to Point", icon: Navigation, color: "bg-red-500" },
};

export default function ChallengeLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: challenge, isLoading } = useQuery({
    queryKey: ["challenge", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!challenge) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Challenge not found</h2>
          <Button onClick={() => navigate("/challenges")}>Back to Challenges</Button>
        </div>
      </AppLayout>
    );
  }

  const typeConfig = CHALLENGE_TYPE_CONFIG[challenge.challenge_type] || { 
    label: challenge.challenge_type, 
    icon: Trophy, 
    color: "bg-muted" 
  };
  const TypeIcon = typeConfig.icon;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/challenges")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${typeConfig.color} text-white`}>
                <TypeIcon className="w-3 h-3 mr-1" />
                {typeConfig.label}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{challenge.name}</h1>
            {challenge.description && (
              <p className="text-muted-foreground text-sm">{challenge.description}</p>
            )}
          </div>
        </header>

        <ChallengeLeaderboard
          challengeId={challenge.id}
          challengeType={challenge.challenge_type}
          rankingMetric={challenge.ranking_metric}
          requiredVerification={challenge.required_verification}
        />
      </div>
    </AppLayout>
  );
}
