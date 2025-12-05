import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlus, Trash2, Upload, X, Camera } from 'lucide-react';

interface ActivityPhoto {
  id: string;
  activity_id: string;
  user_id: string;
  photo_url: string;
  thumb_url: string | null;
  caption: string | null;
  sequence_number: number;
  created_at: string;
}

interface ActivityPhotoManagerProps {
  activityId: string;
}

const MAX_PHOTOS = 10;

export const ActivityPhotoManager: React.FC<ActivityPhotoManagerProps> = ({ activityId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Fetch existing photos
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['activity-photos', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_photos')
        .select('*')
        .eq('activity_id', activityId)
        .order('sequence_number', { ascending: true });
      
      if (error) throw error;
      return data as ActivityPhoto[];
    },
    enabled: !!activityId && !!user
  });

  // Delete photo mutation
  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) throw new Error('Photo not found');

      // Delete from storage
      if (photo.photo_url) {
        const path = photo.photo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('activity-photos').remove([path]);
      }
      if (photo.thumb_url) {
        const thumbPath = photo.thumb_url.split('/').slice(-2).join('/');
        await supabase.storage.from('activity-photos').remove([thumbPath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('activity_photos')
        .delete()
        .eq('id', photoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-photos', activityId] });
      toast({ title: 'Photo deleted' });
    },
    onError: (error) => {
      console.error('Error deleting photo:', error);
      toast({ title: 'Failed to delete photo', variant: 'destructive' });
    }
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      toast({ 
        title: 'Photo limit reached', 
        description: `Maximum ${MAX_PHOTOS} photos allowed per activity.`,
        variant: 'destructive' 
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        setUploadProgress(`Uploading ${i + 1} of ${filesToUpload.length}...`);

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${user.id}/${activityId}/extras/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('activity-photos')
          .upload(filePath, file, { 
            cacheControl: '3600',
            upsert: false 
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('activity-photos')
          .getPublicUrl(filePath);

        // Get next sequence number
        const nextSequence = photos.length + i + 1;

        // Insert into database
        const { error: insertError } = await supabase
          .from('activity_photos')
          .insert({
            activity_id: activityId,
            user_id: user.id,
            photo_url: publicUrl,
            sequence_number: nextSequence
          });

        if (insertError) throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ['activity-photos', activityId] });
      toast({ 
        title: 'Photos uploaded', 
        description: `${filesToUpload.length} photo(s) added successfully.` 
      });

    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({ 
        title: 'Upload failed', 
        description: 'Failed to upload one or more photos.',
        variant: 'destructive' 
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const canAddMore = photos.length < MAX_PHOTOS;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Additional Photos
        </CardTitle>
        <CardDescription>
          Add up to {MAX_PHOTOS} photos to document your journey ({photos.length}/{MAX_PHOTOS} used)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        {canAddMore && (
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isUploading ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">{uploadProgress}</p>
              </div>
            ) : (
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm font-medium">Click to add photos</p>
                <p className="text-xs text-muted-foreground">
                  or drag and drop • Max {MAX_PHOTOS - photos.length} more
                </p>
              </div>
            )}
          </div>
        )}

        {/* Photo grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div 
                key={photo.id} 
                className="relative aspect-square group"
              >
                <img
                  src={photo.thumb_url || photo.photo_url}
                  alt={photo.caption || 'Activity photo'}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => deleteMutation.mutate(photo.id)}
                  disabled={deleteMutation.isPending}
                  className="absolute top-1 right-1 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No additional photos yet. Add some to document your journey!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityPhotoManager;
