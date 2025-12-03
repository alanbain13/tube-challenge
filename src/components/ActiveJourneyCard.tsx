import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Zap, Timer, MapPin, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActiveJourneyCardProps {
  activity: {
    id: string;
    title: string | null;
    started_at: string;
    station_tfl_ids: string[];
    challenge_id?: string | null;
    challenge_target_station_count?: number | null;
  };
  visitedCount: number;
}

export function ActiveJourneyCard({ activity, visitedCount }: ActiveJourneyCardProps) {
  const navigate = useNavigate();
  
  const targetCount = activity.challenge_target_station_count || activity.station_tfl_ids?.length || 0;
  const progressPercent = targetCount > 0 ? Math.round((visitedCount / targetCount) * 100) : 0;
  const startedAt = new Date(activity.started_at);
  const elapsedTime = formatDistanceToNow(startedAt, { addSuffix: false });

  return (
    <Card className="border-action-orange/30 bg-gradient-to-r from-action-orange/5 to-action-orange/10 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-action-orange/20">
              <Zap className="w-5 h-5 text-action-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-action-orange">
                  Active Now
                </span>
              </div>
              <h3 className="font-bold text-lg mt-1">
                {activity.title || "Untitled Activity"}
              </h3>
            </div>
          </div>
          
          <Button
            onClick={() => navigate(`/activities/${activity.id}/checkin`)}
            className="bg-action-orange hover:bg-action-orange/90"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="w-4 h-4" />
            <span>{elapsedTime} elapsed</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{visitedCount} / {targetCount} stations</span>
          </div>
        </div>

        {targetCount > 0 && (
          <div className="mt-4">
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {progressPercent}% complete
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
