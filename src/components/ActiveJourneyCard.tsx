import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, MapPin, Clock } from "lucide-react";

interface ActiveJourneyCardProps {
  activity: {
    id: string;
    title: string | null;
    started_at: string;
    gate_start_at?: string | null;
    station_tfl_ids: string[];
    challenge_id?: string | null;
    challenge_target_station_count?: number | null;
  };
  visitedCount: number;
}

function useElapsedTime(startTime: string) {
  const [elapsed, setElapsed] = useState("");
  
  useEffect(() => {
    const formatTime = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    setElapsed(formatTime());
    const interval = setInterval(() => setElapsed(formatTime()), 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  
  return elapsed;
}

export function ActiveJourneyCard({ activity, visitedCount }: ActiveJourneyCardProps) {
  const navigate = useNavigate();
  const isChallenge = !!activity.challenge_id;
  const timerStart = activity.gate_start_at || activity.started_at;
  const elapsed = useElapsedTime(timerStart);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-md bg-primary/10">
              <Play className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary uppercase tracking-wide">
                  Active {isChallenge ? "Challenge" : "Journey"}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate mt-0.5">
                {activity.title || "Current Activity"}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {elapsed}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {visitedCount} visited
                </span>
              </div>
            </div>
          </div>
          <Button 
            size="sm"
            onClick={() => navigate(`/activities/${activity.id}/checkin`)}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
