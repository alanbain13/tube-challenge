import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, MapPin, Clock, Target, Users, ChevronDown, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface ChallengeDetailModalProps {
  challenge: Tables<"challenges"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AttemptWithUser {
  id: string;
  user_id: string;
  status: string | null;
  duration_minutes: number;
  duration_seconds: number | null;
  stations_visited: number | null;
  started_at: string | null;
  completed_at: string;
  created_at: string;
  profile: {
    display_name: string | null;
    username: string | null;
  } | null;
}

export function ChallengeDetailModal({ challenge, open, onOpenChange }: ChallengeDetailModalProps) {
  const queryClient = useQueryClient();
  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [attemptToDelete, setAttemptToDelete] = useState<{ id: string; userName: string } | null>(null);

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

  // Fetch detailed attempts with user info
  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ["challenge-attempts-detailed", challenge?.id],
    queryFn: async () => {
      if (!challenge) return [];
      
      // First get attempts
      const { data: attemptData, error: attemptError } = await supabase
        .from("challenge_attempts")
        .select("id, user_id, status, duration_minutes, duration_seconds, stations_visited, started_at, completed_at, created_at")
        .eq("challenge_id", challenge.id)
        .order("completed_at", { ascending: false });
      
      if (attemptError) throw attemptError;
      
      // Get unique user IDs
      const userIds = [...new Set(attemptData.map(a => a.user_id))];
      
      // Fetch profiles for those users
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", userIds);
      
      if (profileError) throw profileError;
      
      // Map profiles to attempts
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));
      
      return attemptData.map(attempt => ({
        ...attempt,
        profile: profileMap.get(attempt.user_id) || null
      })) as AttemptWithUser[];
    },
    enabled: !!challenge && open && attemptsOpen,
  });

  // Delete attempt mutation
  const deleteAttemptMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      const { error } = await supabase
        .from("challenge_attempts")
        .delete()
        .eq("id", attemptId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attempt deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["challenge-attempts-detailed", challenge?.id] });
      queryClient.invalidateQueries({ queryKey: ["challenge-attempt-stats", challenge?.id] });
      setAttemptToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete attempt: ${error.message}`);
    },
  });

  if (!challenge) return null;

  const stationMap = new Map(stations?.map(s => [s.tfl_id, s.name]) || []);

  const formatDuration = (minutes: number, seconds?: number | null) => {
    if (seconds) {
      const totalSeconds = minutes * 60 + seconds;
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    }
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}h ${m}m`;
    }
    return `${minutes}m`;
  };

  const getUserDisplayName = (attempt: AttemptWithUser) => {
    return attempt.profile?.display_name || attempt.profile?.username || attempt.user_id.slice(0, 8) + "...";
  };

  return (
    <>
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
            {/* View Leaderboard Link */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/challenges/${challenge.id}/leaderboard`}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Leaderboard
                </Link>
              </Button>
            </div>

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

            {/* Individual Attempts - Collapsible */}
            {attemptStats && attemptStats.totalAttempts > 0 && (
              <>
                <Separator />
                <Collapsible open={attemptsOpen} onOpenChange={setAttemptsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span>Individual Attempts ({attemptStats.totalAttempts})</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${attemptsOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    {attemptsLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Stations</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attempts?.map((attempt) => (
                              <TableRow key={attempt.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">{getUserDisplayName(attempt)}</p>
                                    <p className="text-xs text-muted-foreground font-mono">
                                      {attempt.user_id.slice(0, 8)}...
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={attempt.status === "completed" ? "default" : "secondary"}>
                                    {attempt.status || "unknown"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {formatDuration(attempt.duration_minutes, attempt.duration_seconds)}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {attempt.stations_visited ?? "—"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(attempt.completed_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setAttemptToDelete({ 
                                      id: attempt.id, 
                                      userName: getUserDisplayName(attempt) 
                                    })}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

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

      {/* Delete Attempt Confirmation */}
      <AlertDialog open={!!attemptToDelete} onOpenChange={(open) => !open && setAttemptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attempt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attempt by "{attemptToDelete?.userName}"? 
              This will remove their leaderboard entry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => attemptToDelete && deleteAttemptMutation.mutate(attemptToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAttemptMutation.isPending}
            >
              {deleteAttemptMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
