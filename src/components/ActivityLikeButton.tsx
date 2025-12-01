import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface ActivityLikeButtonProps {
  activityId: string;
  variant?: "default" | "outline";
  showCount?: boolean;
}

export const ActivityLikeButton = ({ 
  activityId, 
  variant = "outline",
  showCount = true 
}: ActivityLikeButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch likes count
  const { data: likesData } = useQuery({
    queryKey: ["activity-likes", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_likes")
        .select("id, user_id")
        .eq("activity_id", activityId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!activityId,
  });

  const likesCount = likesData?.length || 0;
  const isLiked = likesData?.some(like => like.user_id === user?.id) || false;

  // Toggle like mutation
  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from("activity_likes")
          .delete()
          .eq("activity_id", activityId)
          .eq("user_id", user!.id);
        
        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from("activity_likes")
          .insert({
            activity_id: activityId,
            user_id: user!.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-likes", activityId] });
      toast({
        title: isLiked ? "Like removed" : "Activity liked",
        description: isLiked ? "You unliked this activity" : "You liked this activity",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update like",
        variant: "destructive",
      });
    },
  });

  const handleClick = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to like activities",
        variant: "destructive",
      });
      return;
    }
    toggleLikeMutation.mutate();
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleClick}
      disabled={toggleLikeMutation.isPending}
      className={cn(
        "flex items-center gap-2",
        isLiked && "text-red-500 hover:text-red-600"
      )}
    >
      <Heart 
        className={cn(
          "w-4 h-4",
          isLiked && "fill-current"
        )} 
      />
      {showCount && <span>{likesCount}</span>}
    </Button>
  );
};
