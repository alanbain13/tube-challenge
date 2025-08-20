import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

const SIMULATION_MODE_ENV = import.meta.env.DEV || import.meta.env.VITE_SIMULATION_MODE === 'true';

console.log('🛠️ DevPanel: Environment check -', { 
  isDev: import.meta.env.DEV, 
  viteSimMode: import.meta.env.VITE_SIMULATION_MODE,
  SIMULATION_MODE_ENV 
});

interface DevPanelProps {
  className?: string;
}

export const DevPanel = ({ className }: DevPanelProps) => {
  const [userSimulationMode, setUserSimulationMode] = useState(false);

  // Load user preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dev_simulation_mode');
    if (saved !== null) {
      setUserSimulationMode(JSON.parse(saved));
    }
  }, []);

  // Save user preference to localStorage when changed
  const handleSimulationToggle = (enabled: boolean) => {
    setUserSimulationMode(enabled);
    localStorage.setItem('dev_simulation_mode', JSON.stringify(enabled));
  };

  // Don't render if simulation mode is not available in environment
  if (!SIMULATION_MODE_ENV) {
    console.log('🛠️ DevPanel: Not rendering - simulation mode not available in environment');
    return null;
  }

  console.log('🛠️ DevPanel: Rendering with state -', { 
    userSimulationMode, 
    simulationModeEffective: SIMULATION_MODE_ENV && userSimulationMode 
  });

  const simulationModeEffective = SIMULATION_MODE_ENV && userSimulationMode;

  return (
    <Card className={`border-dashed border-orange-200 bg-orange-50/50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-orange-700">
          <Settings className="h-4 w-4" />
          Dev Tools
          <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
            DEV
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="simulation-mode" className="text-sm">
            Simulation mode (bypass geofence)
          </Label>
          <Switch
            id="simulation-mode"
            checked={userSimulationMode}
            onCheckedChange={handleSimulationToggle}
          />
        </div>
        
        {simulationModeEffective && (
          <div className="text-xs text-orange-700 bg-orange-100 p-2 rounded border border-orange-200">
            ✅ Simulation mode is ON — geofence checks will be bypassed for roundel verification.
          </div>
        )}
        
        {!simulationModeEffective && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            Simulation mode is OFF — normal geofence validation will apply.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Hook to get current simulation mode state
export const useSimulationMode = () => {
  const [userSimulationMode, setUserSimulationMode] = useState(false);

  useEffect(() => {
    const updateFromStorage = () => {
      const saved = localStorage.getItem('dev_simulation_mode');
      if (saved !== null) {
        setUserSimulationMode(JSON.parse(saved));
      }
    };

    updateFromStorage();
    
    // Listen for storage changes (for cross-tab sync)
    window.addEventListener('storage', updateFromStorage);
    
    return () => {
      window.removeEventListener('storage', updateFromStorage);
    };
  }, []);

  return {
    simulationModeEnv: SIMULATION_MODE_ENV,
    simulationModeUser: userSimulationMode,
    simulationModeEffective: SIMULATION_MODE_ENV && userSimulationMode
  };
};