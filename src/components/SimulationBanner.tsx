import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Zap } from "lucide-react";

interface SimulationBannerProps {
  visible: boolean;
  className?: string;
}

export const SimulationBanner = ({ visible, className }: SimulationBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) {
    return null;
  }

  return (
    <Alert className={`border-yellow-200 bg-yellow-50 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <Badge variant="outline" className="mr-2 text-yellow-700 border-yellow-300">
              SIMULATION
            </Badge>
            Simulation Mode ON — geofence bypassed
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
};