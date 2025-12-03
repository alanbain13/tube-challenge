import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Play, Flame, MapPin } from "lucide-react";

interface HeroProgressProps {
  displayName: string;
  stationsVisited: number;
  totalStations: number;
  weeklyStations: number;
  streak: number;
  onStartActivity: () => void;
  loading?: boolean;
}

export function HeroProgress({
  displayName,
  stationsVisited,
  totalStations,
  weeklyStations,
  streak,
  onStartActivity,
  loading = false,
}: HeroProgressProps) {
  const percentage = useMemo(() => {
    if (totalStations === 0) return 0;
    return Math.round((stationsVisited / totalStations) * 100 * 10) / 10;
  }, [stationsVisited, totalStations]);

  // SVG circle calculations
  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 md:p-12 text-primary-foreground">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
        {/* Left: Text content */}
        <div className="flex-1 text-center lg:text-left space-y-4">
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome back, {displayName}!
          </h1>
          
          <p className="text-lg md:text-xl opacity-90">
            {percentage}% of the London Underground conquered
          </p>

          <Button
            size="lg"
            variant="secondary"
            className="mt-4 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
            onClick={onStartActivity}
          >
            <Play className="w-5 h-5 mr-2" />
            Start Your Next Journey
          </Button>

          {/* Quick stats */}
          <div className="flex items-center justify-center lg:justify-start gap-6 mt-6 text-sm">
            {streak > 0 && (
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-300" />
                <span>{streak}-day streak</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{weeklyStations} stations this week</span>
            </div>
          </div>
        </div>

        {/* Right: Circular progress */}
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
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="white"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={loading ? circumference : strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl md:text-5xl font-black">
              {loading ? "—" : stationsVisited}
            </span>
            <span className="text-lg opacity-80">/ {totalStations}</span>
            <span className="text-xs uppercase tracking-wider mt-1 opacity-70">
              Stations
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
