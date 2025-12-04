import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, MapPin, Clock, Info } from "lucide-react";
import { useAppSettings, useUpdateAppSetting } from "@/hooks/useAppSettings";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function AppSettingsForm() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateAppSetting();
  
  const [gpsRadius, setGpsRadius] = useState("");
  const [photoMaxAge, setPhotoMaxAge] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form values from settings
  useEffect(() => {
    if (settings) {
      const gpsValue = settings.find(s => s.key === "GPS_RADIUS_METERS")?.value || "750";
      const ageValue = settings.find(s => s.key === "PHOTO_MAX_AGE_SECONDS")?.value || "600";
      setGpsRadius(gpsValue);
      setPhotoMaxAge(ageValue);
      setHasChanges(false);
    }
  }, [settings]);

  const handleGpsRadiusChange = (value: string) => {
    setGpsRadius(value);
    const original = settings?.find(s => s.key === "GPS_RADIUS_METERS")?.value || "750";
    setHasChanges(value !== original || photoMaxAge !== (settings?.find(s => s.key === "PHOTO_MAX_AGE_SECONDS")?.value || "600"));
  };

  const handlePhotoMaxAgeChange = (value: string) => {
    setPhotoMaxAge(value);
    const original = settings?.find(s => s.key === "PHOTO_MAX_AGE_SECONDS")?.value || "600";
    setHasChanges(gpsRadius !== (settings?.find(s => s.key === "GPS_RADIUS_METERS")?.value || "750") || value !== original);
  };

  const handleSave = async () => {
    const originalGps = settings?.find(s => s.key === "GPS_RADIUS_METERS")?.value;
    const originalAge = settings?.find(s => s.key === "PHOTO_MAX_AGE_SECONDS")?.value;

    if (gpsRadius !== originalGps) {
      await updateSetting.mutateAsync({ key: "GPS_RADIUS_METERS", value: gpsRadius });
    }
    if (photoMaxAge !== originalAge) {
      await updateSetting.mutateAsync({ key: "PHOTO_MAX_AGE_SECONDS", value: photoMaxAge });
    }
    setHasChanges(false);
  };

  const formatMinutes = (seconds: string) => {
    const secs = parseInt(seconds, 10);
    if (isNaN(secs)) return "—";
    return `${Math.floor(secs / 60)} min ${secs % 60} sec`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Verification Settings</CardTitle>
          <CardDescription>
            Configure thresholds for station visit verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* GPS Radius Setting */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              <Label htmlFor="gps-radius" className="font-medium">
                GPS Radius (meters)
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Maximum distance from station coordinates for a visit to qualify as <strong>Location Verified</strong>. Both EXIF GPS and device GPS at upload time are checked against this radius.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-4">
              <Input
                id="gps-radius"
                type="number"
                min="100"
                max="5000"
                step="50"
                value={gpsRadius}
                onChange={(e) => handleGpsRadiusChange(e.target.value)}
                className="max-w-[200px]"
              />
              <span className="text-sm text-muted-foreground">
                {parseInt(gpsRadius, 10) >= 1000 
                  ? `${(parseInt(gpsRadius, 10) / 1000).toFixed(1)} km`
                  : `${gpsRadius} m`
                }
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended: 500-1000m for urban areas
            </p>
          </div>

          {/* Photo Max Age Setting */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <Label htmlFor="photo-max-age" className="font-medium">
                Photo Max Age (seconds)
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Maximum time between photo capture (EXIF timestamp) and upload. Photos older than this qualify only as <strong>Remote Verified</strong>, suitable for virtual/remote gameplay.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-4">
              <Input
                id="photo-max-age"
                type="number"
                min="60"
                max="86400"
                step="60"
                value={photoMaxAge}
                onChange={(e) => handlePhotoMaxAgeChange(e.target.value)}
                className="max-w-[200px]"
              />
              <span className="text-sm text-muted-foreground">
                {formatMinutes(photoMaxAge)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended: 300-900 seconds (5-15 minutes)
            </p>
          </div>

          {/* Verification Level Explanation */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <h4 className="font-medium text-sm">Verification Levels</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20 text-green-600 text-xs font-bold">L</span>
                <div>
                  <strong>Location Verified</strong>
                  <p className="text-muted-foreground text-xs">GPS within radius + photo within time limit</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-600 text-xs font-bold">P</span>
                <div>
                  <strong>Photo Verified</strong>
                  <p className="text-muted-foreground text-xs">OCR passed + photo within time limit, no GPS match</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 text-xs font-bold">R</span>
                <div>
                  <strong>Remote Verified</strong>
                  <p className="text-muted-foreground text-xs">OCR passed, photo exceeds time limit (remote/virtual play)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={!hasChanges || updateSetting.isPending}
            >
              {updateSetting.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
