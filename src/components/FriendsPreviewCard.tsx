import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, UserPlus } from "lucide-react";

export function FriendsPreviewCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ['friends-preview', user?.id],
    queryFn: async () => {
      // Get accepted friendships
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('user_id_1, user_id_2')
        .eq('status', 'accepted')
        .or(`user_id_1.eq.${user!.id},user_id_2.eq.${user!.id}`);
      
      if (friendshipsError) throw friendshipsError;
      
      const friendIds = (friendships || []).map(f => 
        f.user_id_1 === user!.id ? f.user_id_2 : f.user_id_1
      );
      
      if (friendIds.length === 0) return { friends: [], count: 0 };
      
      // Get friend profiles sorted by last_active
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, last_active')
        .in('user_id', friendIds)
        .order('last_active', { ascending: false, nullsFirst: false })
        .limit(5);
      
      if (profilesError) throw profilesError;
      
      return {
        friends: profiles || [],
        count: friendIds.length,
      };
    },
    enabled: !!user,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-friend-requests', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id_2', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Friends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          <div className="h-10 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const friends = friendsData?.friends || [];
  const totalCount = friendsData?.count || 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Friends
            {totalCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {totalCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-xs bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/friends')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {friends.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-2">No friends yet</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-7"
              onClick={() => navigate('/friends')}
            >
              <UserPlus className="w-3 h-3 mr-1" />
              Find Friends
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Avatar stack preview */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {friends.slice(0, 4).map((friend: any, index: number) => (
                  <div
                    key={friend.user_id}
                    className="w-7 h-7 rounded-full border-2 border-background bg-muted overflow-hidden"
                    style={{ zIndex: 4 - index }}
                  >
                    {friend.avatar_url ? (
                      <img 
                        src={friend.avatar_url} 
                        alt={friend.display_name || 'Friend'} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {(friend.display_name || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {totalCount > 4 && (
                  <div className="w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    +{totalCount - 4}
                  </div>
                )}
              </div>
            </div>
            
            {/* Friend names list */}
            {friends.slice(0, 3).map((friend: any) => (
              <div 
                key={friend.user_id}
                className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate('/friends')}
              >
                <div className="w-6 h-6 rounded-full bg-muted overflow-hidden">
                  {friend.avatar_url ? (
                    <img 
                      src={friend.avatar_url} 
                      alt={friend.display_name || 'Friend'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {(friend.display_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-foreground truncate">
                  {friend.display_name || 'Friend'}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
