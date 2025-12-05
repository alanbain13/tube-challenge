import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, Play, Square, Eye, Trash2, Hourglass, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { ActivityLikeButton } from "@/components/ActivityLikeButton";
import { ActivityComments } from "@/components/ActivityComments";
import { ChallengeContextCard } from "@/components/ChallengeContextCard";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VerificationLevelBadge, VerificationStatusBadge } from "@/components/VerificationLevelBadge";

// Interface for derived activity state (free-order mode)
interface DerivedActivityState {
  activity_id: string;
  version: number;
  plan: Array<{
    sequence: number;
    station_tfl_id: string;
    display_name: string;
    status: 'not_visited' | 'pending' | 'verified';
    visited_at?: string;
    image_url?: string;
  }>;
  actual_visits: Array<{
    sequence: number;
    station_tfl_id: string;
    display_name: string;
    visited_at: string;
    image_url?: string;
  }>;
  counts: {
    planned_total: number;
    visited_actual: number;
    pending: number;
  };
  started_at?: string;
  finished_at?: string;
  warnings?: {
    empty_plan?: boolean;
  };
}

// Station visit with verification details
interface StationVisitWithVerification {
  id: string;
  station_tfl_id: string;
  visited_at: string;
  verification_status: string | null;
  verification_method: string | null;
  pending_reason: string | null;
  seq_actual: number | null;
  geofence_distance_m: number | null;
  time_diff_seconds: number | null;
  verification_image_url: string | null;
  captured_at: string | null;
  cumulative_duration_seconds: number | null;
  photo_url: string | null;
}

// Use shared VerificationLevelBadge and VerificationStatusBadge from components

const ActivityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { stations } = useStations();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; activityId: string; title: string }>({
    open: false,
    activityId: "",
    title: ""
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Helper function to get station name by TfL ID
  const getStationName = (tflId: string) => {
    const station = stations.find(s => s.id === tflId);
    return station ? station.displayName : tflId;
  };

  // Auth guard and navigation logging
  useEffect(() => {
    console.log(`🧭 ActivityPage enter id=${id} user=${user?.id || 'none'}`);
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate, id]);

  // Fetch activity with derived state (single source of truth)
  const { data: activityState, isLoading, refetch: refetchActivityState } = useQuery({
    queryKey: ["activity_state", id],
    queryFn: async () => {
      console.log(`🔍 ActivityDetail: Fetching state for activity ${id}`);
      const { data, error } = await supabase.rpc('derive_activity_state', { 
        activity_id_param: id 
      });
      if (error) {
        console.error(`❌ DerivedState error for ${id}:`, error);
        throw error;
      }
      
      const derivedState = data as unknown as DerivedActivityState;
      const warnings = derivedState.warnings || {};
      console.log("📊 DerivedState result:", {
        id, 
        planned: derivedState.counts.planned_total, 
        visited: derivedState.counts.visited_actual, 
        actual_visits: derivedState.actual_visits?.length || 0, 
        warnings,
        full_state: derivedState
      });
      return derivedState;
    },
    enabled: !!user && !!id,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch to get latest state
  });

  // Get basic activity info for other operations
  const { data: activity, refetch: refetchActivity } = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => {
    const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
    staleTime: 0, // Always refetch to get latest state
  });

  // Fetch challenge data if this activity is linked to a challenge
  const { data: challenge } = useQuery({
    queryKey: ["challenge", activity?.challenge_id],
    queryFn: async () => {
      if (!activity?.challenge_id) return null;
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", activity.challenge_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activity?.challenge_id,
  });

  // Fetch station visits with verification details
  const { data: stationVisits } = useQuery({
    queryKey: ["station_visits", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("station_visits")
        .select("id, station_tfl_id, visited_at, verification_status, verification_method, pending_reason, seq_actual, geofence_distance_m, time_diff_seconds, verification_image_url, captured_at, cumulative_duration_seconds, photo_url")
        .eq("activity_id", id)
        .eq("status", "verified")
        .order("seq_actual", { ascending: true });
      if (error) throw error;
      return data as StationVisitWithVerification[];
    },
    enabled: !!user && !!id,
  });
  // Auto-refetch when returning to this page (especially from check-in)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 ActivityDetail page focused, refetching data...');
      refetchActivityState();
      refetchActivity();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 ActivityDetail page visible, refetching data...');
        refetchActivityState();
        refetchActivity();
      }
    };

    // Listen for page focus and visibility changes
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refetch when component mounts (user navigates back)
    const timeoutId = setTimeout(() => {
      console.log('🔄 ActivityDetail mounted, refetching data...');
      refetchActivityState();
      refetchActivity();
    }, 100);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timeoutId);
    };
  }, [refetchActivityState, refetchActivity]);

  const handleStartJourney = async () => {
    if (!activity) return;
    
    try {
      const { error } = await supabase
        .from("activities")
        .update({ status: "active" })
        .eq("id", activity.id);

      if (error) throw error;

      toast({
        title: "Journey started",
        description: "Your activity is now active"
      });

      refetchActivityState(); // Refresh state after status change
      navigate(`/activities/${activity.id}/checkin`);
    } catch (error) {
      toast({
        title: "Error starting journey",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleFinishJourney = async () => {
    if (!activity || !activityState || !user) return;
    
    try {
      const endTime = new Date();
      // Get the last visited station from actual visits (chronological order)
      const lastVisited = activityState.actual_visits?.[activityState.actual_visits.length - 1];
      const firstVisit = activityState.actual_visits?.[0];

      // Calculate verification level from station visits (weakest link model)
      let verificationLevel: string | null = null;
      if (stationVisits && stationVisits.length > 0) {
        const hasRemote = stationVisits.some(v => v.verification_status === 'remote_verified' || v.verification_status === 'pending' || !v.verification_status);
        const hasPhoto = stationVisits.some(v => v.verification_status === 'photo_verified');
        const allLocation = stationVisits.every(v => v.verification_status === 'location_verified');
        
        if (allLocation) verificationLevel = 'location_verified';
        else if (!hasRemote && (hasPhoto || stationVisits.some(v => v.verification_status === 'location_verified'))) verificationLevel = 'photo_verified';
        else verificationLevel = 'remote_verified';
      }

      // Update the activity
      const { error } = await supabase
        .from("activities")
        .update({ 
          status: "completed",
          ended_at: endTime.toISOString(),
          end_station_tfl_id: lastVisited?.station_tfl_id || activity.end_station_tfl_id,
          verification_level: verificationLevel
        })
        .eq("id", activity.id);

      if (error) throw error;

      // Update challenge_attempt if this activity is linked to a challenge
      if (activity.challenge_attempt_id && activity.challenge_id) {
        const startTime = firstVisit?.visited_at 
          ? new Date(firstVisit.visited_at) 
          : new Date(activity.started_at);
        const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        const stationsVisited = activityState.counts?.visited_actual || 0;

        // Check for existing personal best
        const { data: existingBest } = await supabase
          .from('challenge_attempts')
          .select('id, duration_seconds, stations_visited')
          .eq('challenge_id', activity.challenge_id)
          .eq('user_id', user.id)
          .eq('is_personal_best', true)
          .neq('id', activity.challenge_attempt_id)
          .maybeSingle();

        // Determine if this is a personal best
        // For timed challenges: more stations = better
        // For other challenges: less time = better
        const isTimedChallenge = challenge?.challenge_type === 'timed';
        let isPersonalBest = !existingBest;
        
        if (existingBest) {
          if (isTimedChallenge) {
            isPersonalBest = stationsVisited > (existingBest.stations_visited || 0);
          } else {
            isPersonalBest = durationSeconds < (existingBest.duration_seconds || Infinity);
          }
        }

        // Update the challenge_attempt record
        const { error: attemptError } = await supabase
          .from('challenge_attempts')
          .update({
            status: 'completed',
            completed_at: endTime.toISOString(),
            started_at: startTime.toISOString(),
            duration_seconds: durationSeconds,
            duration_minutes: Math.floor(durationSeconds / 60),
            stations_visited: stationsVisited,
            is_personal_best: isPersonalBest,
          })
          .eq('id', activity.challenge_attempt_id);

        if (attemptError) {
          console.error('Error updating challenge attempt:', attemptError);
        }

        // If new personal best, unset the old one
        if (isPersonalBest && existingBest) {
          await supabase
            .from('challenge_attempts')
            .update({ is_personal_best: false })
            .eq('id', existingBest.id);
        }
      }

      toast({
        title: "Journey completed",
        description: "Activity finished" + (lastVisited ? ` at ${getStationName(lastVisited.station_tfl_id)}` : "")
      });

      // Evaluate badges in the background (don't block UI)
      supabase.functions.invoke('evaluate-badges', {
        body: { user_id: user.id, activity_id: activity.id }
      }).then(({ data, error }) => {
        if (error) {
          console.error('Badge evaluation error:', error);
        } else if (data?.awarded?.length > 0) {
          console.log('Badges awarded:', data.awarded);
          toast({
            title: "Badge earned!",
            description: `You earned: ${data.awarded.map((b: { name: string }) => b.name).join(', ')}`
          });
        }
      });

      refetchActivityState();
    } catch (error) {
      console.error('Error finishing journey:', error);
      toast({
        title: "Error finishing journey",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleDeleteActivity = async () => {
    if (!deleteModal.activityId) return;
    
    setIsDeleting(true);
    try {
      // First delete related station visits
      const { error: visitsError } = await supabase
        .from("station_visits")
        .delete()
        .eq("activity_id", deleteModal.activityId);
      
      if (visitsError) throw visitsError;

      // Then delete the activity
      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", deleteModal.activityId);

      if (error) throw error;

      toast({
        title: "Activity deleted",
        description: "The activity has been removed"
      });

      navigate("/activities");
    } catch (error) {
      toast({
        title: "Error deleting activity",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // SEO
  useEffect(() => {
    document.title = `${activity?.title || 'Activity'} | Tube Challenge`;
  }, [activity]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading activity...</p>
      </div>
    );
  }

  if (!activity || !activityState) {
    // Enhanced error handling with specific diagnostics
    const isOwnershipIssue = activity && activity.user_id !== user?.id;
    const hasEmptyPlan = activityState && activityState.counts.planned_total === 0;
    const activityExists = !!activity;
    const stateExists = !!activityState;
    
    let errorTitle = "Activity not found";
    let errorDescription = "The requested activity could not be found";
    
    if (activityExists && isOwnershipIssue) {
      errorTitle = "Not your activity";
      errorDescription = "This activity belongs to another user";
    } else if (activityExists && stateExists && hasEmptyPlan) {
      errorTitle = "Empty activity plan";
      errorDescription = "This activity has no planned stations. You can edit it to add stations.";
    } else if (activityExists && !stateExists) {
      errorTitle = "Activity state error";
      errorDescription = `Activity exists but state derivation failed. Please reload.`;
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4">{errorTitle}</h2>
          <p className="text-muted-foreground mb-6">{errorDescription}</p>
          <div className="space-x-2">
            <Button onClick={() => navigate("/activities")}>
              Reload Activities
            </Button>
            {activityExists && hasEmptyPlan && (
              <Button variant="outline" onClick={() => navigate(`/activities/${activity.id}/edit`)}>
                Edit Activity
              </Button>
            )}
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statusText = activity.status === 'draft' ? 'Not started' : 
                    activity.status === 'active' ? 'Active' : 'Completed';

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Use derived state for all UI rendering
  const { plan, counts, actual_visits } = activityState;
  
  // Use gate_start_at (first station visit) for timing, fallback to first actual visit
  const timerStartTime = activity.gate_start_at || (actual_visits?.length > 0 ? actual_visits[0]?.visited_at : null);
  const timerEndTime = activity.gate_end_at || activity.ended_at;
  
  const elapsedTime = timerStartTime && timerEndTime ? 
    new Date(timerEndTime).getTime() - new Date(timerStartTime).getTime() : 
    timerStartTime && activity.status === 'active' ? 
    Date.now() - new Date(timerStartTime).getTime() : 0;
  
  // Log free-order mode state
  console.log(`HUD: Free-order mode | planned=${counts.planned_total} visited=${counts.visited_actual} actual_visits=${actual_visits?.length || 0} (version=${activityState.version})`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate("/activities")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{activity.title || "Untitled Activity"}</h1>
              <p className="text-muted-foreground">Activity Details</p>
            </div>
          </div>
        </header>

        <main className="space-y-6">
          {/* Summary Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Route</div>
                  <div className="font-medium">
                    {activity.start_station_tfl_id && activity.end_station_tfl_id ? 
                      `${getStationName(activity.start_station_tfl_id)} → ${getStationName(activity.end_station_tfl_id)}` : 
                      'No route set'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={activity.status === 'completed' ? 'default' : 'outline'}>
                    {statusText}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Elapsed Time</div>
                  <div className="font-medium">
                    {activity.actual_duration_minutes ? 
                      `${Math.floor(activity.actual_duration_minutes / 60).toString().padStart(2, '0')}:${(activity.actual_duration_minutes % 60).toString().padStart(2, '0')}:00` :
                      formatDuration(elapsedTime)
                    }
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Visited Count</div>
                  <div className="font-medium">
                    {counts.visited_actual}/{(challenge?.challenge_type === 'point_to_point' || challenge?.challenge_type === 'timed' || counts.planned_total === 0) ? 'Open' : counts.planned_total} stations
                  </div>
                </div>
              </div>
              
              {/* Journey Timing - from first/last visit EXIF times */}
              {(() => {
                // Get first and last visit EXIF times from stationVisits
                const sortedVisits = stationVisits?.slice().sort((a, b) => 
                  (a.seq_actual || 0) - (b.seq_actual || 0)
                );
                const firstVisitExif = sortedVisits?.[0]?.captured_at;
                const lastVisitExif = sortedVisits && sortedVisits.length > 0 
                  ? sortedVisits[sortedVisits.length - 1]?.captured_at 
                  : null;
                
                return (
                  <>
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Journey Timing</div>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-xs text-muted-foreground">Start Time</div>
                          <div className="font-medium text-sm">
                            {firstVisitExif ? new Date(firstVisitExif).toLocaleString('en-GB') : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">End Time</div>
                          <div className="font-medium text-sm">
                            {lastVisitExif && activity.status === 'completed' ? new Date(lastVisitExif).toLocaleString('en-GB') : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Activity Record</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-xs text-muted-foreground">Activity Create Time</div>
                          <div className="font-medium text-sm">
                            {new Date(activity.created_at).toLocaleString('en-GB')}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Completion Time</div>
                          <div className="font-medium text-sm">
                            {activity.ended_at ? new Date(activity.ended_at).toLocaleString('en-GB') : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Status</div>
                          <div className="font-medium text-sm">
                            <Badge variant={activity.status === 'completed' ? 'default' : 'outline'} className="mt-1">
                              {statusText}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Challenge Context - Show when activity is linked to a challenge */}
          {challenge && (
            <>
              <ChallengeContextCard
                challenge={challenge}
                activity={{
                  gate_start_at: activity.gate_start_at,
                  status: activity.status || 'draft',
                }}
                visitedCount={counts.visited_actual}
                totalStations={counts.planned_total}
              />
              <ChallengeLeaderboard
                challengeId={challenge.id}
                challengeType={challenge.challenge_type}
                rankingMetric={challenge.ranking_metric}
              />
            </>
          )}

          {/* Empty Plan Info - Updated for free-order mode */}
          {activityState.counts.planned_total === 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">Unplanned Activity</CardTitle>
                <CardDescription className="text-blue-700">
                  This activity has no planned route. You can check in at any station to build your journey as you go.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button onClick={() => navigate(`/activities/${activity.id}/edit`)} variant="outline">
                  Add Planned Route
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteModal({ 
                    open: true, 
                    activityId: activity.id, 
                    title: activity.title || "Untitled Activity" 
                  })}
                  className="text-destructive hover:text-destructive"
                >
                  Delete Activity
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Station Visits Table */}
          <Card>
            <CardHeader>
              <CardTitle>Station Visits</CardTitle>
              <CardDescription>Detailed check-in log with verification status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12">#</th>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-14">Photo</th>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Station Name</th>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Visit Time</th>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Elapsed</th>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Load Time</th>
                      <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* Visited stations */}
                    {actual_visits?.map((visit, index) => {
                      const verificationDetails = stationVisits?.find(
                        sv => sv.station_tfl_id === visit.station_tfl_id
                      );
                      const visitDate = new Date(visit.visited_at);
                      const capturedAt = verificationDetails?.captured_at ? new Date(verificationDetails.captured_at) : null;
                      // First station should always be 00:00:00
                      const cumulativeSecs = index === 0 ? 0 : (verificationDetails?.cumulative_duration_seconds || 0);
                      const cumulativeFormatted = `${String(Math.floor(cumulativeSecs / 3600)).padStart(2, '0')}:${String(Math.floor((cumulativeSecs % 3600) / 60)).padStart(2, '0')}:${String(cumulativeSecs % 60).padStart(2, '0')}`;
                      
                      // Status badge mapping per unified design spec
                      const status = verificationDetails?.verification_status;
                      let statusLabel = 'Pending';
                      let statusColor = 'bg-muted text-muted-foreground';
                      if (status === 'location_verified') {
                        statusLabel = 'LOCATION';
                        statusColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                      } else if (status === 'photo_verified') {
                        statusLabel = 'PHOTO';
                        statusColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                      } else if (status === 'remote_verified') {
                        statusLabel = 'REMOTE';
                        statusColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                      } else if (status === 'failed') {
                        statusLabel = 'Failed';
                        statusColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                      }
                      
                      return (
                        <tr key={`visit-${visit.station_tfl_id}-${index}`} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-3 font-mono text-sm text-muted-foreground">{visit.sequence}</td>
                          <td className="py-3 px-3">
                            {(() => {
                              const imageUrl = verificationDetails?.photo_url || verificationDetails?.verification_image_url;
                              if (imageUrl) {
                                return (
                                  <button 
                                    onClick={() => setLightboxImage(imageUrl)}
                                    className="w-9 h-9 rounded-md overflow-hidden ring-1 ring-border hover:ring-2 hover:ring-primary transition-all shadow-sm"
                                  >
                                    <img src={imageUrl} alt="Station photo" className="w-full h-full object-cover" />
                                  </button>
                                );
                              }
                              return <span className="text-muted-foreground/50">—</span>;
                            })()}
                          </td>
                          <td className="py-3 px-3 font-medium text-sm text-foreground">{getStationName(visit.station_tfl_id)}</td>
                          <td className="py-3 px-3 font-mono text-xs text-muted-foreground tabular-nums">
                            {capturedAt ? `${capturedAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} ${capturedAt.toLocaleTimeString('en-GB')}` : '—'}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs tabular-nums">{cumulativeFormatted}</td>
                          <td className="py-3 px-3 font-mono text-xs text-muted-foreground tabular-nums">
                            {visitDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} {visitDate.toLocaleTimeString('en-GB')}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md cursor-help ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[200px]">
                                  {status === 'location_verified' && <p>GPS within radius + time OK</p>}
                                  {status === 'photo_verified' && <p>OCR passed + time OK, no GPS match</p>}
                                  {status === 'remote_verified' && <p>OCR passed, time exceeded (future: virtual mode)</p>}
                                  {status === 'pending' && <p>Awaiting processing</p>}
                                  {status === 'failed' && <p>OCR/station match failed</p>}
                                  {!status && <p>Awaiting processing</p>}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Planned stations (not yet visited) */}
                    {plan.filter(s => s.status !== 'verified').map((station, index) => (
                      <tr key={`plan-${station.station_tfl_id}-${index}`} className="bg-muted/10">
                        <td className="py-3 px-3 font-mono text-sm text-muted-foreground/50">{(actual_visits?.length || 0) + index + 1}</td>
                        <td className="py-3 px-3">
                          <div className="w-9 h-9 rounded-md bg-muted/50 flex items-center justify-center">
                            <Hourglass className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-sm text-muted-foreground">{getStationName(station.station_tfl_id)}</td>
                        <td className="py-3 px-3 font-mono text-xs text-muted-foreground/50">—</td>
                        <td className="py-3 px-3 font-mono text-xs text-muted-foreground/50">—</td>
                        <td className="py-3 px-3 font-mono text-xs text-muted-foreground/50">—</td>
                        <td className="py-3 px-3 text-right">
                          <span className="inline-flex items-center text-xs font-medium text-muted-foreground/60 bg-muted/50 px-2 py-1 rounded-md">
                            Planned
                          </span>
                        </td>
                      </tr>
                    ))}
                    
                    {plan.length === 0 && (!actual_visits || actual_visits.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-muted-foreground">
                          No stations visited or planned for this activity
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Actions - Free-order mode */}
          <div className="sticky bottom-4 bg-background/80 backdrop-blur-sm border rounded-lg p-4">
            <div className="flex gap-2 justify-center">
                {activity.status === 'draft' && (
                  <Button onClick={handleStartJourney} className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Start Journey
                  </Button>
                )}
                {activity.status === 'active' && (
                  <>
                    <Button onClick={() => navigate(`/activities/${activity.id}/checkin`)} className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      {activityState.counts.planned_total === 0 ? 'Continue Check-in' : 'Continue Check-in'}
                    </Button>
                    <Button onClick={handleFinishJourney} variant="outline" className="flex items-center gap-2">
                      <Square className="w-4 h-4" />
                      Finish Activity
                    </Button>
                  </>
                )}
              <Button 
                variant="outline" 
                onClick={() => navigate(`/activities/${activity.id}/map`)}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View on Map
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setDeleteModal({ 
                  open: true, 
                  activityId: activity.id, 
                  title: activity.title || "Untitled Activity" 
                })}
                className="flex items-center gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Delete Activity
              </Button>
            </div>
          </div>

          {/* Social Features - Only show for completed activities */}
          {activity.status === 'completed' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Likes Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Reactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityLikeButton activityId={activity.id} showCount={true} />
                </CardContent>
              </Card>

              {/* Comments Section - Full Width on smaller screens */}
              <div className="lg:col-span-1">
                <ActivityComments activityId={activity.id} />
              </div>
            </div>
          )}
        </main>
        
        <DeleteConfirmModal
          open={deleteModal.open}
          onOpenChange={(open) => setDeleteModal(prev => ({ ...prev, open }))}
          title="Delete this Activity?"
          description="This action can't be undone. You'll lose this activity and its local progress."
          onConfirm={handleDeleteActivity}
          isDeleting={isDeleting}
        />

        {/* Photo Lightbox */}
        <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/90 border-none">
            <button 
              onClick={() => setLightboxImage(null)}
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {lightboxImage && (
              <img 
                src={lightboxImage} 
                alt="Verification photo" 
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ActivityDetail;