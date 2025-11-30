import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, UserCheck, UserX, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Friendship {
  id: string;
  user_id_1: string;
  user_id_2: string;
  status: string;
  created_at: string;
  profile_1?: Profile;
  profile_2?: Profile;
}

export default function Friends() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch friendships
  const { data: friendships, isLoading } = useQuery({
    queryKey: ["friendships", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      // Fetch friendships first
      const { data: friendshipsData, error: friendshipsError } = await supabase
        .from("friendships")
        .select("*")
        .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`)
        .order("created_at", { ascending: false });

      if (friendshipsError) throw friendshipsError;
      if (!friendshipsData || friendshipsData.length === 0) return [];

      // Get all unique user IDs we need to fetch
      const userIds = new Set<string>();
      friendshipsData.forEach(f => {
        userIds.add(f.user_id_1);
        userIds.add(f.user_id_2);
      });

      // Fetch all relevant profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", Array.from(userIds));

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profileMap = new Map<string, Profile>();
      profilesData?.forEach(p => profileMap.set(p.user_id, p));

      // Combine friendships with profiles
      const enrichedFriendships = friendshipsData.map(f => ({
        ...f,
        profile_1: profileMap.get(f.user_id_1),
        profile_2: profileMap.get(f.user_id_2),
      }));

      return enrichedFriendships as Friendship[];
    },
    enabled: !!currentUser,
  });

  // Search users
  const { data: searchResults } = useQuery({
    queryKey: ["user-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .neq("user_id", currentUser?.id)
        .limit(10);

      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!searchQuery && searchQuery.length >= 2 && !!currentUser,
  });

  // Send friend request
  const sendRequestMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase
        .from("friendships")
        .insert({
          user_id_1: currentUser?.id,
          user_id_2: targetUserId,
          status: "pending",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast({
        title: "Friend request sent",
        description: "Your friend request has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send friend request",
        variant: "destructive",
      });
    },
  });

  // Accept friend request
  const acceptRequestMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast({
        title: "Friend request accepted",
        description: "You are now friends!",
      });
    },
  });

  // Reject friend request
  const rejectRequestMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast({
        title: "Friend request declined",
      });
    },
  });

  // Remove friend
  const removeFriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast({
        title: "Friend removed",
      });
    },
  });

  const acceptedFriends = friendships?.filter(f => f.status === "accepted") || [];
  const pendingRequests = friendships?.filter(
    f => f.status === "pending" && f.user_id_2 === currentUser?.id
  ) || [];
  const sentRequests = friendships?.filter(
    f => f.status === "pending" && f.user_id_1 === currentUser?.id
  ) || [];

  const getOtherProfile = (friendship: Friendship): Profile | undefined => {
    return friendship.user_id_1 === currentUser?.id
      ? friendship.profile_2
      : friendship.profile_1;
  };

  const getDisplayName = (profile?: Profile) => {
    return profile?.display_name || profile?.username || "Unknown User";
  };

  const isAlreadyFriend = (userId: string) => {
    return friendships?.some(
      f =>
        (f.user_id_1 === userId || f.user_id_2 === userId) &&
        (f.status === "accepted" || f.status === "pending")
    );
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black mb-2">Friends</h1>
          <p className="text-muted-foreground">Connect with other metro explorers</p>
        </div>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="friends">
              <Users className="w-4 h-4 mr-2" />
              Friends ({acceptedFriends.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              <UserPlus className="w-4 h-4 mr-2" />
              Requests ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="w-4 h-4 mr-2" />
              Find Friends
            </TabsTrigger>
          </TabsList>

          {/* Friends List */}
          <TabsContent value="friends">
            {isLoading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Loading friends...</p>
                </CardContent>
              </Card>
            ) : acceptedFriends.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No friends yet. Search for users to connect!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {acceptedFriends.map((friendship) => {
                  const profile = getOtherProfile(friendship);
                  return (
                    <Card key={friendship.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getDisplayName(profile).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{getDisplayName(profile)}</h3>
                            <p className="text-sm text-muted-foreground">
                              Friends since {format(new Date(friendship.created_at), "MMM yyyy")}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => removeFriendMutation.mutate(friendship.id)}
                        >
                          <UserX className="w-4 h-4 mr-2" />
                          Remove Friend
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Pending Requests */}
          <TabsContent value="requests">
            <div className="space-y-6">
              {/* Incoming Requests */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Incoming Requests</h2>
                {pendingRequests.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">No pending friend requests</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingRequests.map((friendship) => {
                      const profile = getOtherProfile(friendship);
                      return (
                        <Card key={friendship.id}>
                          <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={profile?.avatar_url || undefined} />
                                <AvatarFallback>
                                  {getDisplayName(profile).charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-semibold">{getDisplayName(profile)}</h3>
                                <p className="text-sm text-muted-foreground">
                                  Sent {format(new Date(friendship.created_at), "MMM d")}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => acceptRequestMutation.mutate(friendship.id)}
                              >
                                <UserCheck className="w-4 h-4 mr-2" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => rejectRequestMutation.mutate(friendship.id)}
                              >
                                <UserX className="w-4 h-4 mr-2" />
                                Decline
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sent Requests */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Sent Requests</h2>
                {sentRequests.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">No pending outgoing requests</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sentRequests.map((friendship) => {
                      const profile = getOtherProfile(friendship);
                      return (
                        <Card key={friendship.id}>
                          <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={profile?.avatar_url || undefined} />
                                <AvatarFallback>
                                  {getDisplayName(profile).charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <h3 className="font-semibold">{getDisplayName(profile)}</h3>
                                <Badge variant="secondary">Pending</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Search Users */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle>Find Friends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {searchQuery.length < 2 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Type at least 2 characters to search
                  </p>
                ) : !searchResults || searchResults.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No users found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback>
                              {getDisplayName(profile).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">{getDisplayName(profile)}</h3>
                            {profile.username && (
                              <p className="text-sm text-muted-foreground">@{profile.username}</p>
                            )}
                          </div>
                        </div>
                        {isAlreadyFriend(profile.user_id) ? (
                          <Badge variant="secondary">Already connected</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => sendRequestMutation.mutate(profile.user_id)}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add Friend
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
