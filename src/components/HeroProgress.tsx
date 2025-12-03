import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Play, Flame, MapPin, Globe } from "lucide-react";

interface HeroProgressProps {
  displayName: string;
  stationsVisited: number;
  totalStations: number;
  weeklyStations: number;
  streak: number;
  metroName?: string;
  onStartActivity: () => void;
  loading?: boolean;
}

export function HeroProgress({
  displayName,
  stationsVisited,
  totalStations,
  weeklyStations,
  streak,
  metroName = "stations",
  onStartActivity,
  loading = false,
}: HeroProgressProps) {
  const percentage = useMemo(() => {
    if (totalStations === 0) return 0;
    return Math.round((stationsVisited / totalStations) * 100 * 10) / 10;
  }, [stationsVisited, totalStations]);

  // SVG circle calculations - smaller, more refined
  const size = 140;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-xl bg-card border border-border p-6 md:p-8">
      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        {/* Left: Circular progress */}
        <div className="relative flex-shrink-0">
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={loading ? circumference : strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl md:text-3xl font-bold text-foreground">
              {loading ? "—" : stationsVisited}
            </span>
            <span className="text-xs text-muted-foreground">/ {totalStations}</span>
          </div>
        </div>

        {/* Right: Text content */}
        <div className="flex-1 text-center sm:text-left space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              {displayName}
            </h1>
          </div>
          
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">{percentage}%</span> of your journey complete
          </p>

          {/* Quick stats */}
          <div className="flex items-center justify-center sm:justify-start gap-4 text-xs text-muted-foreground">
            {streak > 0 && (
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>{streak}-day streak</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{weeklyStations} this week</span>
            </div>
          </div>

          <Button
            size="sm"
            className="mt-2"
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
