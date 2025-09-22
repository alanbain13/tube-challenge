import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Play, Square, ArrowRight, X, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Activity {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  gate_start_at: string | null;
  gate_end_at: string | null;
}

export function JourneyTimer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasAutoHidden, setHasAutoHidden] = useState(false);
  
  // Only show HUD when user is actively checking in
  const isOnCheckinPage = location.pathname.includes('/checkin');

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current active activity with verified check-in
  const { data: activeActivity, refetch } = useQuery({
    queryKey: ["activeActivity", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          station_visits!inner(id, status, verified_at, is_start_station)
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("gate_end_at", null)
        .eq("station_visits.is_start_station", true)
        .in("station_visits.status", ["verified"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching active activity:", error);
        return null;
      }

      return data?.[0] as Activity | null;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Check if user has an active activity without verified start
  const { data: pendingActivity } = useQuery({
    queryKey: ["pendingActivity", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "draft"])
        .is("gate_end_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) return null;

      // Check if this activity has a verified start check-in
      if (data?.[0]) {
        const { data: startVisit } = await supabase
          .from("station_visits")
          .select("status")
          .eq("activity_id", data[0].id)
          .eq("is_start_station", true)
          .eq("status", "verified")
          .limit(1);

        // Return activity only if no verified start exists
        return startVisit?.length ? null : data[0];
      }
      
      return null;
    },
    enabled: !!user && !activeActivity,
    refetchInterval: 30000,
  });

  const handleStartJourney = async () => {
    if (!activeActivity) return;
    
    try {
      console.log('🕐 Starting journey for activity:', activeActivity.id);
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from("activities")
        .update({ gate_start_at: now })
        .eq("id", activeActivity.id);

      if (error) throw error;

      toast({
        title: "Journey timer started",
        description: "Official journey timing has begun"
      });

      refetch();
    } catch (error) {
      console.error('Error starting journey timer:', error);
      toast({
        title: "Error starting journey timer",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleFinishJourney = async () => {
    if (!activeActivity) return;
    
    try {
      console.log('🏁 Finishing journey for activity:', activeActivity.id);
      const now = new Date().toISOString();
      
      // Calculate journey duration
      const startTime = new Date(activeActivity.gate_start_at!);
      const endTime = new Date(now);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      const { error } = await supabase
        .from("activities")
        .update({ 
          gate_end_at: now,
          status: "completed",
          actual_duration_minutes: durationMinutes
        })
        .eq("id", activeActivity.id);

      if (error) throw error;

      toast({
        title: "Journey finished",
        description: `${Math.floor(durationMinutes / 60).toString().padStart(2, '0')}:${(durationMinutes % 60).toString().padStart(2, '0')}:00 recorded`
      });

      // Auto-hide HUD after successful completion
      setIsExpanded(false);
      setHasAutoHidden(true);

      // Force immediate refetch to hide the HUD
      await refetch();
    } catch (error) {
      console.error('Error finishing journey timer:', error);
      toast({
        title: "Error finishing journey timer",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Auto-hide HUD after first successful check-in (start journey)
  useEffect(() => {
    if (activeActivity?.gate_start_at && !hasAutoHidden && isOnCheckinPage) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
        setHasAutoHidden(true);
      }, 3000); // Show for 3 seconds after starting
      
      return () => clearTimeout(timer);
    }
  }, [activeActivity?.gate_start_at, hasAutoHidden, isOnCheckinPage]);

  const formatElapsedTime = (startTime: string): string => {
    const start = new Date(startTime);
    const elapsed = Math.floor((currentTime.getTime() - start.getTime()) / 1000);
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Show pending notice if activity exists but no verified start (on any page)
  if (pendingActivity && !activeActivity && !isOnCheckinPage) {
    return (
      <Card className={cn(
        "fixed z-50 p-4 bg-background/95 backdrop-blur-sm border shadow-lg",
        isMobile ? "bottom-20 left-4 right-4" : "bottom-6 right-6 min-w-[280px]"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <div className="text-sm flex-1">
            <div className="font-medium text-foreground">
              Check in at your start station to begin
            </div>
            <div className="text-muted-foreground">
              {pendingActivity.title}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/activities/${pendingActivity.id}/checkin`)}
          >
            Check-in
          </Button>
        </div>
      </Card>
    );
  }

  // Don't show if no active activity with verified start or not on checkin page
  if (!activeActivity || !isOnCheckinPage) {
    return null;
  }

  const hasStarted = !!activeActivity.gate_start_at;
  const hasFinished = !!activeActivity.gate_end_at;
  const canStart = !hasStarted;
  const canFinish = hasStarted && !hasFinished;

  // FAB for mobile when collapsed
  if (!isExpanded) {
    return (
      <TooltipProvider>
        <div className={cn(
          "fixed z-50",
          isMobile 
            ? "bottom-20 right-4" // Above bottom nav on mobile
            : "bottom-6 right-6"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setIsExpanded(true)}
                size={isMobile ? "default" : "lg"}
                className={cn(
                  "rounded-full shadow-lg",
                  isMobile ? "h-14 w-14" : "h-16 w-16"
                )}
              >
                <Clock className={cn(
                  isMobile ? "h-6 w-6" : "h-8 w-8"
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>View journey timer</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Card className={cn(
        "fixed z-40 bg-background/95 backdrop-blur-sm border shadow-lg",
        isMobile 
          ? "bottom-20 left-4 right-4" // Above bottom nav, full width on mobile
          : "bottom-6 right-6 min-w-[320px] max-w-[400px]"
      )}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="p-4">
            {/* Header with timer and collapse toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium text-foreground">
                    {activeActivity.title}
                  </div>
                </div>
              </div>
              
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>

            {/* Timer status */}
            <div className="text-sm text-muted-foreground mb-4">
              {hasStarted ? (
                hasFinished ? (
                  `Completed in ${formatElapsedTime(activeActivity.gate_start_at!)}`
                ) : (
                  <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {formatElapsedTime(activeActivity.gate_start_at!)}
                  </span>
                )
              ) : (
                "Ready to start official timing"
              )}
            </div>

            <CollapsibleContent className="space-y-3">
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/activities/${activeActivity.id}`)}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Exit check-in and return to activity</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={hasStarted ? handleFinishJourney : handleStartJourney}
                      disabled={hasFinished}
                      className="flex-1"
                    >
                      {hasStarted ? (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          Finish
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Continue
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!hasStarted ? "Continue with check-in process" : 
                       hasFinished ? "Journey already finished" : 
                       "Finish official journey timing"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </Card>
    </TooltipProvider>
  );
}