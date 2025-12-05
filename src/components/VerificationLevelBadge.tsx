import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPinCheck, Camera, Globe } from "lucide-react";
import { VERIFICATION_LEVEL_CONFIG, RequiredVerification } from "@/lib/challengeVerification";

const ICONS = {
  MapPinCheck,
  Camera,
  Globe,
};

interface VerificationLevelBadgeProps {
  level: RequiredVerification | string | null | undefined;
  /** Show compact version (short label only) */
  compact?: boolean;
  /** Show icon with label */
  showIcon?: boolean;
  /** Show tooltip with description */
  showTooltip?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Unified verification level badge component
 * Used across Station Visits, Activities, Challenges, and Badges
 */
export function VerificationLevelBadge({
  level,
  compact = false,
  showIcon = true,
  showTooltip = true,
  className = "",
}: VerificationLevelBadgeProps) {
  // Default to remote_verified if no level provided
  const verificationLevel = (level || 'remote_verified') as RequiredVerification;
  const config = VERIFICATION_LEVEL_CONFIG[verificationLevel];
  
  if (!config) return null;

  const IconComponent = ICONS[config.icon];
  const displayLabel = compact ? config.shortLabel : config.label;

  const badge = (
    <Badge 
      variant="outline" 
      className={`${config.bgColor} ${config.color} ${config.borderColor} gap-1 ${className}`}
    >
      {showIcon && <IconComponent className="h-3 w-3" />}
      {displayLabel}
    </Badge>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * Simple status badge for pending/failed states
 */
export function VerificationStatusBadge({ 
  status 
}: { 
  status: string | null 
}) {
  if (status === 'pending') {
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
        Pending
      </Badge>
    );
  }
  
  if (status === 'failed') {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
        Failed
      </Badge>
    );
  }

  // For verification statuses, use the main badge
  return <VerificationLevelBadge level={status} />;
}
