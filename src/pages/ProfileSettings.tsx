import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SearchStationInput from '@/components/SearchStationInput';
import { useStations } from '@/hooks/useStations';
import { ArrowLeft, Loader2, Upload, CheckCircle2, XCircle } from 'lucide-react';

export default function ProfileSettings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { stations } = useStations();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Profile fields
  const [realName, setRealName] = useState('');  // Real name (from username field)
  const [displayName, setDisplayName] = useState('');  // Unique ID (from display_name field)
  const [homeStation, setHomeStation] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  
  // Display name validation state
  const [displayNameChecking, setDisplayNameChecking] = useState(false);
  const [displayNameAvailable, setDisplayNameAvailable] = useState<boolean | null>(null);
  const [originalDisplayName, setOriginalDisplayName] = useState('');
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification preferences
  const [emailOnLike, setEmailOnLike] = useState(true);
  const [emailOnComment, setEmailOnComment] = useState(true);
  const [prefsLoading, setPrefsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (profile) {
      setRealName(profile.username || '');  // Real name from username field
      setDisplayName(profile.display_name || '');  // Unique ID from display_name field
      setOriginalDisplayName(profile.display_name || '');  // Store original for comparison
      setHomeStation(profile.home_station || '');
      setSelectedAvatar(profile.avatar_url || '');
    }

    // Fetch notification preferences
    const fetchPreferences = async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('email_on_like, email_on_comment')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setEmailOnLike(data.email_on_like);
        setEmailOnComment(data.email_on_comment);
      }
    };

    fetchPreferences();
  }, [user, profile, navigate]);

  // Real-time display name uniqueness check with debounce
  useEffect(() => {
    const trimmedDisplayName = displayName.trim();
    
    // Reset validation state if empty or same as original
    if (!trimmedDisplayName || trimmedDisplayName === originalDisplayName) {
      setDisplayNameAvailable(null);
      setDisplayNameChecking(false);
      return;
    }

    // Validate format first
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedDisplayName)) {
      setDisplayNameAvailable(null);
      setDisplayNameChecking(false);
      return;
    }

    // Debounce the uniqueness check
    setDisplayNameChecking(true);
    const timeoutId = setTimeout(async () => {
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('display_name', trimmedDisplayName)
          .neq('user_id', user!.id)
          .maybeSingle();

        setDisplayNameAvailable(!existingProfile);
      } catch (error) {
        console.error('Error checking display name:', error);
        setDisplayNameAvailable(null);
      } finally {
        setDisplayNameChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [displayName, user, originalDisplayName]);

  // Find the station object for the currently selected home station
  const selectedHomeStation = useMemo(() => {
    if (!homeStation) return undefined;
    return stations.find(s => s.name === homeStation);
  }, [homeStation, stations]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!realName.trim()) {
      toast({
        title: "Error",
        description: "Your name is required",
        variant: "destructive"
      });
      return;
    }

    // Validate real name (only letters and spaces)
    if (!/^[a-zA-Z\s]+$/.test(realName.trim())) {
      toast({
        title: "Invalid Name",
        description: "Your name can only contain letters and spaces",
        variant: "destructive"
      });
      return;
    }

    // Validate display name format if provided
    if (displayName && !/^[a-zA-Z0-9_-]+$/.test(displayName.trim())) {
      toast({
        title: "Invalid Display Name",
        description: "Display name can only contain letters, numbers, dashes and underscores (no spaces)",
        variant: "destructive"
      });
      return;
    }

    // Check display name uniqueness if provided
    if (displayName.trim()) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('display_name', displayName.trim())
        .neq('user_id', user!.id)
        .maybeSingle();

      if (existingProfile) {
        toast({
          title: "Display Name Taken",
          description: "This display name is already in use. Please choose another.",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user!.id,
          username: realName.trim(),  // Real name → username field
          display_name: displayName.trim() || null,  // Unique ID → display_name field
          home_station: homeStation.trim() || null,
          avatar_url: selectedAvatar
        }, { onConflict: 'user_id' });

      if (error) throw error;

      await refreshProfile();
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    setPasswordLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Password change failed",
        description: error.message || "Failed to change password",
        variant: "destructive"
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: uploadError.message,
        variant: "destructive"
      });
    } else {
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      setSelectedAvatar(data.publicUrl);
      toast({
        title: "Avatar uploaded",
        description: "Your avatar has been uploaded successfully."
      });
    }

    setUploading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleNotificationPrefsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsLoading(true);

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user!.id,
          email_on_like: emailOnLike,
          email_on_comment: emailOnComment,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated"
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update preferences",
        variant: "destructive"
      });
    } finally {
      setPrefsLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your profile details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="real-name">Your Name *</Label>
                    <Input
                      id="real-name"
                      type="text"
                      value={realName}
                      onChange={(e) => setRealName(e.target.value)}
                      placeholder="Alan Bainbridge"
                      pattern="[a-zA-Z\s]+"
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Your real name - letters and spaces only
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display-name">Display Name</Label>
                    <div className="relative">
                      <Input
                        id="display-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alan-013"
                        pattern="[a-zA-Z0-9_-]+"
                        className={
                          displayName.trim() && displayName.trim() !== originalDisplayName
                            ? displayNameAvailable === false
                              ? 'pr-10 border-destructive focus-visible:ring-destructive'
                              : displayNameAvailable === true
                              ? 'pr-10 border-green-500 focus-visible:ring-green-500'
                              : ''
                            : ''
                        }
                      />
                      {displayNameChecking && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!displayNameChecking && displayNameAvailable === true && displayName.trim() !== originalDisplayName && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                      {!displayNameChecking && displayNameAvailable === false && (
                        <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <p className={`text-sm ${
                      displayNameAvailable === false 
                        ? 'text-destructive' 
                        : displayNameAvailable === true && displayName.trim() !== originalDisplayName
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }`}>
                      {displayNameAvailable === false 
                        ? 'This display name is already taken' 
                        : displayNameAvailable === true && displayName.trim() !== originalDisplayName
                        ? 'This display name is available'
                        : 'Your unique username - must be unique, letters (upper/lower), numbers, dashes and underscores only'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="home-station">Home Station</Label>
                    <SearchStationInput
                      stations={stations}
                      onStationSelect={(station) => setHomeStation(station.name)}
                      placeholder="Search for your home station"
                      selectedStation={selectedHomeStation}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>Profile Picture</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="w-20 h-20">
                        <AvatarImage src={selectedAvatar} />
                        <AvatarFallback>
                          {realName.slice(0, 2).toUpperCase() || 'TC'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          id="avatar-upload-settings"
                        />
                        <Label htmlFor="avatar-upload-settings" className="cursor-pointer">
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            disabled={uploading}
                            asChild
                          >
                            <span>
                              <Upload className="h-4 w-4 mr-2" />
                              {uploading ? 'Uploading...' : 'Upload New Avatar'}
                            </span>
                          </Button>
                        </Label>
                        <p className="text-sm text-muted-foreground mt-2">
                          JPG, PNG or GIF (max 5MB)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      type="submit" 
                      disabled={loading || displayNameChecking || displayNameAvailable === false}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate('/')}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how you want to be notified about activity on your posts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleNotificationPrefsUpdate} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="email-on-like" className="text-base font-medium">
                          Email me when someone likes my activity
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Get an email notification every time someone likes your activity
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        id="email-on-like"
                        checked={emailOnLike}
                        onChange={(e) => setEmailOnLike(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="email-on-comment" className="text-base font-medium">
                          Email me when someone comments on my activity
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Get an email notification every time someone comments on your activity
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        id="email-on-comment"
                        checked={emailOnComment}
                        onChange={(e) => setEmailOnComment(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button type="submit" disabled={prefsLoading}>
                      {prefsLoading ? 'Saving...' : 'Save Preferences'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage your password and account security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                    />
                  </div>

                  <Button type="submit" disabled={passwordLoading}>
                    {passwordLoading ? 'Changing...' : 'Change Password'}
                  </Button>
                </form>

                <div className="pt-6 border-t">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Email</h3>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                    
                    <Button variant="destructive" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
