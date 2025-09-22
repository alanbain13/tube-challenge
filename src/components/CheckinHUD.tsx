import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  Upload, 
  RefreshCw, 
  HelpCircle, 
  ChevronUp, 
  ChevronDown,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Wifi,
  WifiOff
} from "lucide-react";
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

export type CheckinState = 'idle' | 'verifying' | 'verified' | 'pending' | 'failed' | 'offline';

interface CheckinHUDProps {
  state: CheckinState;
  stationName?: string;
  error?: string;
  onCameraCapture?: () => void;
  onFileUpload?: () => void;
  onRetry?: () => void;
  onHelp?: () => void;
  isUploading?: boolean;
  autoHideAfterSuccess?: boolean;
  className?: string;
}

export function CheckinHUD({
  state,
  stationName,
  error,
  onCameraCapture,
  onFileUpload,
  onRetry,
  onHelp,
  isUploading = false,
  autoHideAfterSuccess = true,
  className
}: CheckinHUDProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasAutoHidden, setHasAutoHidden] = useState(false);
  const isMobile = useIsMobile();

  // Auto-hide after first successful check-in
  useEffect(() => {
    if (autoHideAfterSuccess && state === 'verified' && !hasAutoHidden) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
        setHasAutoHidden(true);
      }, 2000); // Show success for 2 seconds before hiding
      
      return () => clearTimeout(timer);
    }
  }, [state, autoHideAfterSuccess, hasAutoHidden]);

  const getStateInfo = () => {
    switch (state) {
      case 'verified':
        return {
          icon: CheckCircle,
          color: 'bg-emerald-500',
          text: `Check-in confirmed${stationName ? ` at ${stationName}` : ''}`,
          variant: 'default' as const
        };
      case 'pending':
        return {
          icon: Clock,
          color: 'bg-amber-500',
          text: 'Check-in saved; will sync later',
          variant: 'secondary' as const
        };
      case 'failed':
        return {
          icon: XCircle,
          color: 'bg-destructive',
          text: error || 'Check-in failed',
          variant: 'destructive' as const
        };
      case 'offline':
        return {
          icon: WifiOff,
          color: 'bg-muted-foreground',
          text: 'Offline: saved locally, will sync automatically',
          variant: 'outline' as const
        };
      case 'verifying':
        return {
          icon: RefreshCw,
          color: 'bg-primary',
          text: 'Verifying check-in...',
          variant: 'default' as const
        };
      default:
        return {
          icon: Camera,
          color: 'bg-primary',
          text: 'Ready to check in',
          variant: 'default' as const
        };
    }
  };

  const stateInfo = getStateInfo();
  const StateIcon = stateInfo.icon;

  // FAB for mobile when collapsed
  if (!isExpanded) {
    return (
      <TooltipProvider>
        <div className={cn(
          "fixed z-50",
          // Position with safe area respect
          isMobile 
            ? "bottom-20 right-4" // Above bottom nav on mobile
            : "bottom-6 right-6",
          className
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
                <StateIcon className={cn(
                  isMobile ? "h-6 w-6" : "h-8 w-8",
                  state === 'verifying' && "animate-spin"
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{stateInfo.text}</p>
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
        // Position with safe area respect
        isMobile 
          ? "bottom-20 left-4 right-4" // Above bottom nav, full width on mobile
          : "bottom-6 right-6 min-w-[320px] max-w-[400px]",
        className
      )}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="p-4">
            {/* Header with status and collapse toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  stateInfo.color,
                  state === 'verifying' && "animate-pulse"
                )} />
                <Badge variant={stateInfo.variant} className="text-xs">
                  <StateIcon className={cn(
                    "h-3 w-3 mr-1",
                    state === 'verifying' && "animate-spin"
                  )} />
                  {state.charAt(0).toUpperCase() + state.slice(1)}
                </Badge>
              </div>
              
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>

            {/* Status message */}
            <div className="text-sm text-foreground mb-4">
              {stateInfo.text}
            </div>

            <CollapsibleContent className="space-y-3">
              {/* Action buttons */}
              <div className="flex gap-2">
                {onCameraCapture && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={onCameraCapture}
                        size="sm"
                        disabled={isUploading || state === 'verifying'}
                        className="flex-1"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Camera
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Take photo to check in</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {onFileUpload && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={onFileUpload}
                        variant="outline"
                        size="sm"
                        disabled={isUploading || state === 'verifying'}
                        className="flex-1"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Upload existing photo</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Secondary actions */}
              <div className="flex gap-2">
                {onRetry && (state === 'failed' || error) && (
                  <Button
                    onClick={onRetry}
                    variant="outline"
                    size="sm"
                    disabled={isUploading || state === 'verifying'}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}

                {onHelp && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={onHelp}
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                      >
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Help
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Get check-in help</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Network status indicator */}
              <div className="flex items-center justify-center pt-2 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {navigator.onLine ? (
                    <>
                      <Wifi className="h-3 w-3" />
                      Online
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" />
                      Offline
                    </>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </Card>
    </TooltipProvider>
  );
}