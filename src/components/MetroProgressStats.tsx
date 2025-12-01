import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MapPin, TrendingUp, Clock } from "lucide-react";

interface MetroProgressStatsProps {
  visitedCount: number;
  totalStations: number;
  progressPercent: number;
  currentPace?: number; // visits per hour
  estimatedCompletion?: string;
}

export default function MetroProgressStats({
  visitedCount,
  totalStations,
  progressPercent,
  currentPace,
  estimatedCompletion
}: MetroProgressStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-sm text-muted-foreground">Stations Visited</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{visitedCount}</span>
            <span className="text-xl text-muted-foreground">/ {totalStations}</span>
          </div>
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <p className="text-sm font-medium text-primary">{progressPercent}% Complete</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-accent/10">
            <TrendingUp className="h-5 w-5 text-accent-foreground" />
          </div>
          <h3 className="font-semibold text-sm text-muted-foreground">Current Pace</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {currentPace ? currentPace.toFixed(1) : '—'}
            </span>
            <span className="text-xl text-muted-foreground">/week</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {currentPace && currentPace > 0 ? 'Keep it up!' : 'Start exploring!'}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-secondary/10">
            <Clock className="h-5 w-5 text-secondary-foreground" />
          </div>
          <h3 className="font-semibold text-sm text-muted-foreground">Est. Completion</h3>
        </div>
        <div className="space-y-3">
          <div className="text-2xl font-bold">
            {estimatedCompletion || 'N/A'}
          </div>
          <p className="text-sm text-muted-foreground">
            {currentPace && currentPace > 0 
              ? 'At current pace' 
              : 'Visit stations to estimate'}
          </p>
        </div>
      </Card>
    </div>
  );
}