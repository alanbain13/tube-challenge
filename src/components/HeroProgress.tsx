import { Button } from "@/components/ui/button";
import { Play, Trophy, Award, Target, Flame, MapPin } from "lucide-react";

interface HeroProgressProps {
  displayName: string;
  stationsVisited: number;
  totalStations: number;
  weeklyStations: number;
  streak: number;
  challengesCompleted?: number;
  badgesEarned?: number;
  bestLeaderboardRank?: number | null;
  onStartActivity: () => void;
  loading?: boolean;
}

export function HeroProgress({
  displayName,
  stationsVisited,
  totalStations,
  weeklyStations,
  streak,
  challengesCompleted = 0,
  badgesEarned = 0,
  bestLeaderboardRank,
  onStartActivity,
  loading = false,
}: HeroProgressProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-card border border-border p-5 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        {/* Left: Welcome and stats */}
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              {displayName}
            </h1>
          </div>

          {/* Achievement highlights */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Target className="w-3 h-3 text-primary" />
                <span className="text-lg font-bold text-foreground">
                  {loading ? "—" : challengesCompleted}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Challenges</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Award className="w-3 h-3 text-accent" />
                <span className="text-lg font-bold text-foreground">
                  {loading ? "—" : badgesEarned}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Badges</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Trophy className="w-3 h-3 text-yellow-500" />
                <span className="text-lg font-bold text-foreground">
                  {loading ? "—" : (bestLeaderboardRank ? `#${bestLeaderboardRank}` : "—")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Best Rank</p>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{stationsVisited}/{totalStations} stations</span>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>{streak}-day streak</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span>{weeklyStations} this week</span>
            </div>
          </div>
        </div>

        {/* Right: CTA */}
        <div className="sm:flex-shrink-0">
          <Button
            size="sm"
            onClick={onStartActivity}
          >
            <Play className="w-4 h-4 mr-1.5" />
            Start Journey
          </Button>
        </div>
      </div>
    </div>
  );
}
