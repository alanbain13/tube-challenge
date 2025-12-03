import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Users, Trophy, Award, Database, Plus, Trash2, Loader2, Eye } from "lucide-react";
import SyncStationsFromGeoJSON from "@/components/SyncStationsFromGeoJSON";
import UpdateStationZones from "@/components/UpdateStationZones";
import { ChallengeCreateForm } from "@/components/admin/ChallengeCreateForm";
import type { Database as DB } from "@/integrations/supabase/types";

type AppRole = DB["public"]["Enums"]["app_role"];

interface UserWithRoles {
  user_id: string;
  email: string;
  display_name: string | null;
  roles: AppRole[];
}

const Admin = () => {
  const queryClient = useQueryClient();
  const [newRoleUserId, setNewRoleUserId] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("user");
  const [challengeToDelete, setChallengeToDelete] = useState<{ id: string; name: string } | null>(null);

  // Fetch all users with their roles
  const { data: usersWithRoles, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-roles"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username");

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine data
      const userMap = new Map<string, UserWithRoles>();
      
      profiles?.forEach((p) => {
        userMap.set(p.user_id, {
          user_id: p.user_id,
          email: p.username || "Unknown",
          display_name: p.display_name,
          roles: [],
        });
      });

      roles?.forEach((r) => {
        const user = userMap.get(r.user_id);
        if (user) {
          user.roles.push(r.role);
        } else {
          userMap.set(r.user_id, {
            user_id: r.user_id,
            email: "Unknown",
            display_name: null,
            roles: [r.role],
          });
        }
      });

      return Array.from(userMap.values());
    },
  });

  // Fetch challenges
  const { data: challenges, isLoading: challengesLoading } = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role added successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users-roles"] });
      setNewRoleUserId("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add role: ${error.message}`);
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users-roles"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove role: ${error.message}`);
    },
  });

  // Delete challenge mutation (handles cascade)
  const deleteChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      // First delete related challenge_attempts
      const { error: attemptsError } = await supabase
        .from("challenge_attempts")
        .delete()
        .eq("challenge_id", challengeId);
      
      if (attemptsError) throw attemptsError;

      // Then delete the challenge itself
      const { error: challengeError } = await supabase
        .from("challenges")
        .delete()
        .eq("id", challengeId);
      
      if (challengeError) throw challengeError;
    },
    onSuccess: () => {
      toast.success("Challenge deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      setChallengeToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete challenge: ${error.message}`);
    },
  });

  const handleAddRole = () => {
    if (!newRoleUserId.trim()) {
      toast.error("Please enter a user ID");
      return;
    }
    addRoleMutation.mutate({ userId: newRoleUserId, role: newRole });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage users, challenges, badges, and station data</p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users & Roles</span>
            </TabsTrigger>
            <TabsTrigger value="challenges" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Challenges</span>
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span className="hidden sm:inline">Badges</span>
            </TabsTrigger>
            <TabsTrigger value="stations" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Stations</span>
            </TabsTrigger>
          </TabsList>

          {/* Users & Roles Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add Role to User</CardTitle>
                <CardDescription>Assign a role to a user by their user ID</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      placeholder="Enter user UUID"
                      value={newRoleUserId}
                      onChange={(e) => setNewRoleUserId(e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-40">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddRole} disabled={addRoleMutation.isPending}>
                      {addRoleMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span className="ml-2">Add Role</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Users with Roles</CardTitle>
                <CardDescription>All users who have been assigned roles</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithRoles?.filter(u => u.roles.length > 0).map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{user.display_name || "No name"}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{user.user_id.slice(0, 8)}...</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.roles.map((role) => (
                                <Badge key={role} variant={role === "admin" ? "destructive" : "secondary"}>
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {user.roles.map((role) => (
                                <Button
                                  key={role}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeRoleMutation.mutate({ userId: user.user_id, role })}
                                  disabled={removeRoleMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Challenges Tab */}
          <TabsContent value="challenges" className="space-y-4">
            <ChallengeCreateForm />
            
            <Card>
              <CardHeader>
                <CardTitle>Existing Challenges</CardTitle>
                <CardDescription>View and manage official challenges</CardDescription>
              </CardHeader>
              <CardContent>
                {challengesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : challenges?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No challenges found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Stations</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Official</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challenges?.map((challenge) => (
                        <TableRow key={challenge.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{challenge.name}</p>
                              {challenge.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {challenge.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{challenge.challenge_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {challenge.challenge_type === "timed" 
                              ? `${Math.floor((challenge.time_limit_seconds || 0) / 60)} min`
                              : challenge.challenge_type === "station_count"
                              ? `${challenge.target_station_count} stations`
                              : `${challenge.station_tfl_ids?.length || 0} stations`}
                          </TableCell>
                          <TableCell>
                            {challenge.difficulty && (
                              <Badge variant="secondary" className="capitalize">
                                {challenge.difficulty}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={challenge.is_official ? "default" : "secondary"}>
                              {challenge.is_official ? "Official" : "User"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`/challenges/${challenge.id}/leaderboard`} target="_blank">
                                  <Eye className="w-4 h-4" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setChallengeToDelete({ id: challenge.id, name: challenge.name })}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Delete Challenge Confirmation Dialog */}
            <AlertDialog open={!!challengeToDelete} onOpenChange={(open) => !open && setChallengeToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Challenge</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{challengeToDelete?.name}"? This will also delete all 
                    associated challenge attempts and leaderboard data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => challengeToDelete && deleteChallengeMutation.mutate(challengeToDelete.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteChallengeMutation.isPending}
                  >
                    {deleteChallengeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          {/* Badges Tab */}
          <TabsContent value="badges" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Badge Management</CardTitle>
                <CardDescription>View and manage badge definitions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">Badge management coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stations Tab */}
          <TabsContent value="stations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Station Data Management</CardTitle>
                <CardDescription>Sync and update station data from GeoJSON source</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <SyncStationsFromGeoJSON />
                  <UpdateStationZones />
                </div>
                <p className="text-sm text-muted-foreground">
                  Use these tools to synchronize station data from the GeoJSON file to the database.
                  This ensures station coordinates, zones, and line assignments are up to date.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Admin;
