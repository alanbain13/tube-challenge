import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface ProfileSetupProps {
  userId: string;
  onComplete: () => void;
}

const PLACEHOLDER_AVATARS = [
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1535268647677-3057574bb30c?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=150&h=150&fit=crop&crop=face'
];

export default function ProfileSetup({ userId, onComplete }: ProfileSetupProps) {
  const [realName, setRealName] = useState('');  // Real name (stored in username field)
  const [displayName, setDisplayName] = useState('');  // Unique ID (stored in display_name field)
  const [homeStation, setHomeStation] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PLACEHOLDER_AVATARS[0]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Load existing profile data if available
  useEffect(() => {
    const loadProfile = async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('username, display_name, home_station, avatar_url')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (data) {
        setRealName(data.username || '');  // Real name from username field
        setDisplayName(data.display_name || '');  // Unique ID from display_name field
        setHomeStation(data.home_station || '');
        if (data.avatar_url) {
          setSelectedAvatar(data.avatar_url);
        }
      }
      setLoading(false);
    };
    
    loadProfile();
  }, [userId]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

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

  const handleSave = async () => {
    if (!realName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
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

    // Validate display name if provided
    if (displayName && !/^[a-zA-Z0-9_-]+$/.test(displayName.trim())) {
      toast({
        title: "Invalid Display Name",
        description: "Display name can only contain letters, numbers, dashes and underscores (no spaces)",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    // Use any type to work around TypeScript issues with generated types
    const { error } = await (supabase as any)
      .from('profiles')
      .upsert({
        user_id: userId,
        username: realName.trim(),  // Real name → username field
        display_name: displayName.trim() || null,  // Unique ID → display_name field
        home_station: homeStation.trim() || null,
        avatar_url: selectedAvatar
      }, { onConflict: 'user_id' });

    if (error) {
      toast({
        title: "Profile update failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been set up successfully!"
      });
      onComplete();
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
          <p className="text-muted-foreground">
            Let's set up your Tube Challenge profile
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Selection */}
          <div className="space-y-4">
            <Label>Profile Picture</Label>
            <div className="flex justify-center">
              <Avatar className="w-24 h-24">
                <AvatarImage src={selectedAvatar} />
                <AvatarFallback>
                  {realName.slice(0, 2).toUpperCase() || 'TC'}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* Placeholder Avatars */}
            <div className="grid grid-cols-4 gap-2">
              {PLACEHOLDER_AVATARS.map((avatar, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`w-12 h-12 rounded-full border-2 ${
                    selectedAvatar === avatar ? 'border-primary' : 'border-muted'
                  }`}
                >
                  <Avatar className="w-full h-full">
                    <AvatarImage src={avatar} />
                  </Avatar>
                </button>
              ))}
            </div>

            {/* Custom Upload */}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
              />
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button variant="outline" size="sm" className="w-full" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload Custom Avatar'}
                </Button>
              </Label>
            </div>
          </div>

          {/* Your Name */}
          <div className="space-y-2">
            <Label htmlFor="real-name">Your Name *</Label>
            <Input
              id="real-name"
              placeholder="Alan Bainbridge"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              pattern="[a-zA-Z\s]+"
              required
            />
            <p className="text-sm text-muted-foreground">
              Your real name - letters and spaces only
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name (Optional)</Label>
            <Input
              id="display-name"
              placeholder="Alan-013"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              pattern="[a-zA-Z0-9_-]+"
            />
            <p className="text-sm text-muted-foreground">
              Your unique username - letters, numbers, dashes and underscores only
            </p>
          </div>

          {/* Home Station */}
          <div className="space-y-2">
            <Label htmlFor="home-station">Home Station (Optional)</Label>
            <Input
              id="home-station"
              placeholder="e.g., King's Cross St. Pancras"
              value={homeStation}
              onChange={(e) => setHomeStation(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Your default station for local challenges
            </p>
          </div>

          <Button 
            onClick={handleSave} 
            className="w-full" 
            disabled={saving || !realName.trim()}
          >
            {saving ? 'Saving...' : 'Complete Profile'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}