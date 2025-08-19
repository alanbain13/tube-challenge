import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Play, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current active activity
  const { data: activeActivity, refetch } = useQuery({
    queryKey: ["activeActivity", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching active activity:", error);
        return null;
      }

      return data as Activity | null;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
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
      
      const { error } = await supabase
        .from("activities")
        .update({ gate_end_at: now })
        .eq("id", activeActivity.id);

      if (error) throw error;

      toast({
        title: "Journey timer finished",
        description: "Official journey timing completed"
      });

      refetch();
    } catch (error) {
      console.error('Error finishing journey timer:', error);
      toast({
        title: "Error finishing journey timer",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const formatElapsedTime = (startTime: string): string => {
    const start = new Date(startTime);
    const elapsed = Math.floor((currentTime.getTime() - start.getTime()) / 1000);
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Don't show if no active activity
  if (!activeActivity) {
    return null;
  }

  const hasStarted = !!activeActivity.gate_start_at;
  const hasFinished = !!activeActivity.gate_end_at;
  const canStart = !hasStarted;
  const canFinish = hasStarted && !hasFinished;

  return (
    <TooltipProvider>
      <Card className="fixed bottom-4 right-4 z-50 p-4 bg-background/95 backdrop-blur-sm border shadow-lg">
        <div className="flex items-center gap-4 min-w-[280px]">
          {/* Timer Display */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <div className="font-medium text-foreground">
                {activeActivity.title}
              </div>
              <div className="text-muted-foreground">
                {hasStarted ? (
                  hasFinished ? (
                    `Completed in ${formatElapsedTime(activeActivity.gate_start_at!)}`
                  ) : (
                    formatElapsedTime(activeActivity.gate_start_at!)
                  )
                ) : (
                  "Ready to start"
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartJourney}
                  disabled={!canStart}
                  className="h-8"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {canStart ? "Start official journey timing" : "Journey already started"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFinishJourney}
                  disabled={!canFinish}
                  className="h-8"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Finish
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!hasStarted ? "Start journey first" : 
                 hasFinished ? "Journey already finished" : 
                 "Finish official journey timing"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}