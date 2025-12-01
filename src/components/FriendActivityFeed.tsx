import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FriendActivityCard } from "./FriendActivityCard";
import { Loader2 } from "lucide-react";

export const FriendActivityFeed = () => {
  const { user } = useAuth();

  // Fetch friends' completed activities
  const { data: friendActivities = [], isLoading } = useQuery({
    queryKey: ["friend-activities"],
    queryFn: async () => {
      // Get list of friend IDs
      const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("user_id_1, user_id_2")
        .eq("status", "accepted")
        .or(`user_id_1.eq.${user!.id},user_id_2.eq.${user!.id}`);

      if (friendshipsError) throw friendshipsError;

      // Extract friend IDs
      const friendIds = friendships.map(f => 
        f.user_id_1 === user!.id ? f.user_id_2 : f.user_id_1
      );

      if (friendIds.length === 0) {
        return [];
      }

      // Fetch completed activities from friends
      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select("id, title, status, start_station_tfl_id, end_station_tfl_id, ended_at, user_id, station_tfl_ids")
        .eq("status", "completed")
        .in("user_id", friendIds)
        .order("ended_at", { ascending: false })
        .limit(20);

      if (activitiesError) throw activitiesError;

      // Fetch profiles for all friend users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, username")
        .in("user_id", friendIds);

      // Fetch likes and comments counts for each activity
      const activitiesWithCounts = await Promise.all(
        activities.map(async (activity: any) => {
          // Get likes count
          const { data: likes } = await supabase
            .from("activity_likes")
            .select("id")
            .eq("activity_id", activity.id);

          // Get comments count
          const { data: comments } = await supabase
            .from("activity_comments")
            .select("id")
            .eq("activity_id", activity.id);

          // Find matching profile
          const profile = profiles?.find(p => p.user_id === activity.user_id);

          return {
            ...activity,
            profiles: profile || null,
            likesCount: likes?.length || 0,
            commentsCount: comments?.length || 0,
          };
        })
      );

      return activitiesWithCounts;
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (friendActivities.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-4">No activities yet</h2>
          <p className="text-muted-foreground">
            When your friends complete activities, they'll appear here. Add some friends to get started!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {friendActivities.map((activity: any) => (
        <FriendActivityCard
          key={activity.id}
          activity={activity}
          profile={activity.profiles}
          likesCount={activity.likesCount}
          commentsCount={activity.commentsCount}
        />
      ))}
    </div>
  );
};
