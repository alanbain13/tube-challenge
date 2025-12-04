import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AppSettingsMap {
  GPS_RADIUS_METERS: string;
  PHOTO_MAX_AGE_SECONDS: string;
  [key: string]: string;
}

/**
 * Hook to fetch all app settings
 */
export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("key");

      if (error) throw error;
      return data as AppSetting[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get settings as a key-value map
 */
export function useAppSettingsMap() {
  const { data: settings, ...rest } = useAppSettings();
  
  const settingsMap: AppSettingsMap = {
    GPS_RADIUS_METERS: "750",
    PHOTO_MAX_AGE_SECONDS: "600",
  };

  if (settings) {
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
  }

  return { data: settingsMap, ...rest };
}

/**
 * Get GPS radius in meters (with default fallback)
 */
export function getGpsRadiusMeters(settings: AppSettingsMap | undefined): number {
  return parseInt(settings?.GPS_RADIUS_METERS || "750", 10);
}

/**
 * Get photo max age in seconds (with default fallback)
 */
export function getPhotoMaxAgeSeconds(settings: AppSettingsMap | undefined): number {
  return parseInt(settings?.PHOTO_MAX_AGE_SECONDS || "600", 10);
}

/**
 * Hook to update a setting
 */
export function useUpdateAppSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("app_settings")
        .update({ 
          value, 
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null
        })
        .eq("key", key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Setting updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update setting: ${error.message}`);
    },
  });
}
