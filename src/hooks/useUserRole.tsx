import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useUserRole = () => {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) {
        console.error("Error fetching user roles:", error);
        return [];
      }
      
      return data.map((r) => r.role);
    },
    enabled: !!user?.id,
  });

  return {
    roles: roles || [],
    isAdmin: roles?.includes("admin") || false,
    isModerator: roles?.includes("moderator") || false,
    isLoading,
  };
};
