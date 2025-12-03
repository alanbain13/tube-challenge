import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, MapPin, Clock, Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface ChallengeDetailModalProps {
  challenge: Tables<"challenges"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChallengeDetailModal({ challenge, open, onOpenChange }: ChallengeDetailModalProps) {
  // Fetch station names for display
  const { data: stations } = useQuery({
    queryKey: ["stations-for-challenge", challenge?.id],
    queryFn: async () => {
      if (!challenge?.station_tfl_ids?.length) return [];
      const { data, error } = await supabase
        .from("stations")
        .select("tfl_id, name")
        .in("tfl_id", challenge.station_tfl_ids);
      if (error) throw error;
      return data;
    },
    enabled: !!challenge && open,
  });

  // Fetch attempt stats
  const { data: attemptStats, isLoading: statsLoading } = useQuery({
    queryKey: ["challenge-attempt-stats", challenge?.id],
    queryFn: async () => {
      if (!challenge) return null;
      const { data, error } = await supabase
        .from("challenge_attempts")
        .select("id, status, duration_minutes, user_id")
        .eq("challenge_id", challenge.id);
      if (error) throw error;
      
      const uniqueUsers = new Set(data.map(a => a.user_id)).size;
      const completed = data.filter(a => a.status === "completed").length;
      const avgDuration = completed > 0
        ? Math.round(data.filter(a => a.status === "completed").reduce((sum, a) => sum + a.duration_minutes, 0) / completed)
        : 0;
      
      return {
        totalAttempts: data.length,
        completedAttempts: completed,
        uniqueUsers,
        avgDurationMinutes: avgDuration,
      };
    },
    enabled: !!challenge && open,
  });

  if (!challenge) return null;

  const stationMap = new Map(stations?.map(s => [s.tfl_id, s.name]) || []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {challenge.name}
            <Badge variant={challenge.is_official ? "default" : "secondary"}>
              {challenge.is_official ? "Official" : "User Created"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline" className="mt-1">{challenge.challenge_type}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Difficulty</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {challenge.difficulty || "Not set"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ranking Metric</p>
              <p className="font-medium capitalize">{challenge.ranking_metric || "time"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sequenced</p>
              <p className="font-medium">{challenge.is_sequenced ? "Yes" : "No"}</p>
            </div>
          </div>

          {challenge.description && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p>{challenge.description}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Challenge Parameters */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Challenge Parameters</p>
            <div className="grid grid-cols-2 gap-3">
              {challenge.time_limit_seconds && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Time Limit: {Math.floor(challenge.time_limit_seconds / 60)} min</span>
                </div>
              )}
              {challenge.target_station_count && (
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span>Target: {challenge.target_station_count} stations</span>
                </div>
              )}
              {challenge.estimated_duration_minutes && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Est. Duration: {challenge.estimated_duration_minutes} min</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>Stations: {challenge.station_tfl_ids?.length || 0}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Attempt Statistics */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Attempt Statistics</p>
            {statsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : attemptStats ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>Unique Users: {attemptStats.uniqueUsers}</span>
                </div>
                <div>
                  <span>Total Attempts: {attemptStats.totalAttempts}</span>
                </div>
                <div>
                  <span>Completed: {attemptStats.completedAttempts}</span>
                </div>
                {attemptStats.avgDurationMinutes > 0 && (
                  <div>
                    <span>Avg Duration: {attemptStats.avgDurationMinutes} min</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No attempts yet</p>
            )}
          </div>

          {/* Station List */}
          {challenge.station_tfl_ids && challenge.station_tfl_ids.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Stations ({challenge.station_tfl_ids.length})
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {challenge.station_tfl_ids.map((tflId, idx) => (
                    <div key={tflId} className="text-sm flex items-center gap-2">
                      {challenge.is_sequenced && (
                        <span className="text-muted-foreground w-6">{idx + 1}.</span>
                      )}
                      <span>{stationMap.get(tflId) || tflId}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>ID: {challenge.id}</p>
            <p>Created: {new Date(challenge.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(challenge.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
