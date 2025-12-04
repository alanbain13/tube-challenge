import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, Play, Square, Eye, Trash2, MapPinCheck, Camera, Globe, Hourglass } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { ActivityLikeButton } from "@/components/ActivityLikeButton";
import { ActivityComments } from "@/components/ActivityComments";
import { ChallengeContextCard } from "@/components/ChallengeContextCard";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";

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

// Verification status badge component
const VerificationBadge = ({ status, compact = false }: { status: string | null; compact?: boolean }) => {
  const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    location_verified: { 
      label: compact ? "Location" : "Location Verified", 
      icon: <MapPinCheck className="h-3 w-3" />,
      className: "bg-green-500/20 text-green-700 border-green-300" 
    },
    photo_verified: { 
      label: compact ? "Photo" : "Photo Verified", 
      icon: <Camera className="h-3 w-3" />,
      className: "bg-yellow-500/20 text-yellow-700 border-yellow-300" 
    },
    remote_verified: { 
      label: compact ? "Remote" : "Remote Verified", 
      icon: <Globe className="h-3 w-3" />,
      className: "bg-blue-500/20 text-blue-700 border-blue-300" 
    },
    failed: { 
      label: "Failed", 
      icon: null,
      className: "bg-red-500/20 text-red-700 border-red-300" 
    },
    pending: { 
      label: "Pending", 
      icon: null,
      className: "bg-gray-500/20 text-gray-700 border-gray-300" 
    },
  };
  
  const config = statusConfig[status || 'pending'] || statusConfig.pending;
  return (
    <Badge variant="outline" className={`${config.className} gap-1`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};

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

      // Update the activity
      const { error } = await supabase
        .from("activities")
        .update({ 
          status: "completed",
          ended_at: endTime.toISOString(),
          end_station_tfl_id: lastVisited?.station_tfl_id || activity.end_station_tfl_id
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
              
              {/* Timestamps Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-4 pt-4 border-t border-border">
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div className="font-medium text-sm">
                    {new Date(activity.created_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Started</div>
                  <div className="font-medium text-sm">
                    {timerStartTime ? new Date(timerStartTime).toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                  <div className="font-medium text-sm">
                    {activity.ended_at ? new Date(activity.ended_at).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
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
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 px-2 text-left font-medium">#</th>
                      <th className="py-2 px-2 text-left font-medium">Photo</th>
                      <th className="py-2 px-2 text-left font-medium">Time</th>
                      <th className="py-2 px-2 text-left font-medium">Station</th>
                      <th className="py-2 px-2 text-left font-medium">Check-in</th>
                      <th className="py-2 px-2 text-left font-medium">Cumulative</th>
                      <th className="py-2 px-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Visited stations */}
                    {actual_visits?.map((visit, index) => {
                      const verificationDetails = stationVisits?.find(
                        sv => sv.station_tfl_id === visit.station_tfl_id
                      );
                      const visitDate = new Date(visit.visited_at);
                      const capturedAt = verificationDetails?.captured_at ? new Date(verificationDetails.captured_at) : null;
                      const cumulativeSecs = verificationDetails?.cumulative_duration_seconds || 0;
                      const cumulativeFormatted = `${String(Math.floor(cumulativeSecs / 3600)).padStart(2, '0')}:${String(Math.floor((cumulativeSecs % 3600) / 60)).padStart(2, '0')}:${String(cumulativeSecs % 60).padStart(2, '0')}`;
                      
                      // Status badge mapping per spec
                      const status = verificationDetails?.verification_status;
                      let statusLabel = 'Pending';
                      let statusColor = 'bg-gray-400';
                      if (status === 'location_verified') {
                        statusLabel = 'Location';
                        statusColor = 'bg-green-500';
                      } else if (status === 'photo_verified') {
                        statusLabel = 'Photo';
                        statusColor = 'bg-yellow-500';
                      } else if (status === 'remote_verified') {
                        statusLabel = 'Remote';
                        statusColor = 'bg-blue-500';
                      } else if (status === 'failed') {
                        statusLabel = 'Failed';
                        statusColor = 'bg-red-500';
                      }
                      
                      return (
                        <tr key={`visit-${visit.station_tfl_id}-${index}`} className="border-b last:border-0">
                          <td className="py-3 px-2 font-medium">{visit.sequence}</td>
                          <td className="py-3 px-2">
                            {verificationDetails?.photo_url ? (
                              <Camera className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {capturedAt ? capturedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3 px-2 font-medium">{getStationName(visit.station_tfl_id)}</td>
                          <td className="py-3 px-2 text-muted-foreground text-xs">
                            {visitDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} {visitDate.toLocaleTimeString('en-GB')}
                          </td>
                          <td className="py-3 px-2 font-mono text-xs">{cumulativeFormatted}</td>
                          <td className="py-3 px-2 text-right">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-white px-2 py-0.5 rounded ${statusColor}`}>
                              <span className="w-2 h-2 rounded-full bg-white/30"></span>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Planned stations (not yet visited) */}
                    {plan.filter(s => s.status !== 'verified').map((station, index) => (
                      <tr key={`plan-${station.station_tfl_id}-${index}`} className="border-b last:border-0 text-muted-foreground">
                        <td className="py-3 px-2">{(actual_visits?.length || 0) + index + 1}</td>
                        <td className="py-3 px-2">
                          <Hourglass className="w-4 h-4 text-muted-foreground/50" />
                        </td>
                        <td className="py-3 px-2">—</td>
                        <td className="py-3 px-2 font-medium text-foreground">{getStationName(station.station_tfl_id)}</td>
                        <td className="py-3 px-2">—</td>
                        <td className="py-3 px-2">—</td>
                        <td className="py-3 px-2 text-right">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
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
      </div>
    </div>
  );
};

export default ActivityDetail;