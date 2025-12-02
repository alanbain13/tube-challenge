import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Route, MapPin, Timer, Hash, Navigation, Clock, Target, AlertTriangle } from "lucide-react";
import { useStations } from "@/hooks/useStations";
import { useEffect, useState } from "react";

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  challenge_type: string;
  station_tfl_ids: string[];
  is_sequenced: boolean | null;
  start_station_tfl_id: string | null;
  end_station_tfl_id: string | null;
  time_limit_seconds: number | null;
  target_station_count: number | null;
  ranking_metric: string | null;
}

interface ChallengeContextCardProps {
  challenge: Challenge;
  activity: {
    gate_start_at: string | null;
    status: string;
  };
  visitedCount: number;
  totalStations: number;
}

const CHALLENGE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Trophy; color: string }> = {
  sequenced_route: { label: "Sequenced Route", icon: Route, color: "bg-blue-500" },
  unsequenced_route: { label: "Any Order", icon: MapPin, color: "bg-green-500" },
  timed: { label: "Timed Challenge", icon: Timer, color: "bg-orange-500" },
  station_count: { label: "Station Count", icon: Hash, color: "bg-purple-500" },
  point_to_point: { label: "Point to Point", icon: Navigation, color: "bg-red-500" },
};

export const ChallengeContextCard = ({ 
  challenge, 
  activity, 
  visitedCount, 
  totalStations 
}: ChallengeContextCardProps) => {
  const { stations } = useStations();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const getStationName = (tflId: string | null) => {
    if (!tflId) return "Unknown";
    const station = stations.find(s => s.id === tflId);
    return station ? station.displayName : tflId;
  };

  const typeConfig = CHALLENGE_TYPE_CONFIG[challenge.challenge_type] || { 
    label: challenge.challenge_type, 
    icon: Trophy, 
    color: "bg-muted" 
  };
  const TypeIcon = typeConfig.icon;

  // Timed challenge countdown
  useEffect(() => {
    if (challenge.challenge_type !== "timed" || !challenge.time_limit_seconds || !activity.gate_start_at) {
      return;
    }

    const calculateRemaining = () => {
      const startTime = new Date(activity.gate_start_at!).getTime();
      const endTime = startTime + (challenge.time_limit_seconds! * 1000);
      const remaining = Math.max(0, endTime - Date.now());
      setTimeRemaining(remaining);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [challenge.challenge_type, challenge.time_limit_seconds, activity.gate_start_at]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalStations > 0 
    ? Math.round((visitedCount / totalStations) * 100) 
    : 0;

  const targetCount = challenge.target_station_count || totalStations;
  const stationCountProgress = targetCount > 0 
    ? Math.round((visitedCount / targetCount) * 100) 
    : 0;

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={`${typeConfig.color} text-white`}>
              <TypeIcon className="w-3 h-3 mr-1" />
              {typeConfig.label}
            </Badge>
            <Badge variant="outline" className="text-primary border-primary">
              Challenge Mode
            </Badge>
          </div>
        </div>
        <CardTitle className="text-lg mt-2">{challenge.name}</CardTitle>
        {challenge.description && (
          <CardDescription>{challenge.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Challenge-specific UI */}
        
        {/* Sequenced Route - Show sequence progress */}
        {challenge.challenge_type === "sequenced_route" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sequence Progress</span>
              <span className="font-medium">{visitedCount} / {totalStations} stations</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Route className="w-4 h-4" />
              <span>Follow the route in order</span>
            </div>
          </div>
        )}

        {/* Unsequenced Route - Show checklist progress */}
        {challenge.challenge_type === "unsequenced_route" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stations Collected</span>
              <span className="font-medium">{visitedCount} / {totalStations}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>Visit all stations in any order</span>
            </div>
          </div>
        )}

        {/* Timed Challenge - Show countdown */}
        {challenge.challenge_type === "timed" && (
          <div className="space-y-3">
            {activity.gate_start_at && timeRemaining !== null ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Time Remaining</span>
                  <span className={`font-mono text-2xl font-bold ${timeRemaining < 300000 ? 'text-destructive' : 'text-primary'}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                {timeRemaining < 300000 && timeRemaining > 0 && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Less than 5 minutes remaining!</span>
                  </div>
                )}
                {timeRemaining === 0 && activity.status === "active" && (
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Time's up!</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Time limit: {challenge.time_limit_seconds ? formatTime(challenge.time_limit_seconds * 1000) : "N/A"}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stations Visited</span>
              <span className="font-medium">{visitedCount}</span>
            </div>
          </div>
        )}

        {/* Station Count - Show progress to target */}
        {challenge.challenge_type === "station_count" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress to Target</span>
              <span className="font-medium">{visitedCount} / {targetCount} stations</span>
            </div>
            <Progress value={stationCountProgress} className="h-2" />
            {visitedCount >= targetCount && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <Target className="w-4 h-4" />
                <span>Target reached! Finish to complete.</span>
              </div>
            )}
          </div>
        )}

        {/* Point to Point - Show start/end */}
        {challenge.challenge_type === "point_to_point" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-xs text-green-600 mb-1">Start Station</div>
                <div className="font-medium text-sm">{getStationName(challenge.start_station_tfl_id)}</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-xs text-red-600 mb-1">End Station</div>
                <div className="font-medium text-sm">{getStationName(challenge.end_station_tfl_id)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Navigation className="w-4 h-4" />
              <span>Stations visited: {visitedCount}</span>
            </div>
          </div>
        )}

        {/* Ranking metric hint */}
        {challenge.ranking_metric && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Trophy className="w-3 h-3" />
              <span>
                Leaderboard ranks by: {challenge.ranking_metric === "time" ? "Fastest time" : 
                  challenge.ranking_metric === "station_count" ? "Most stations" : challenge.ranking_metric}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
