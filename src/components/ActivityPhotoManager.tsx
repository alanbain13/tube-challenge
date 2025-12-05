import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Check, Loader2 } from 'lucide-react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCamera, setIsCamera] = useState(false);

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
        const urlParts = photo.photo_url.split('/activity-photos/');
        if (urlParts[1]) {
          await supabase.storage.from('activity-photos').remove([urlParts[1]]);
        }
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
      queryClient.invalidateQueries({ queryKey: ['activity-extra-photos', 'activity', activityId] });
      toast({ title: 'Photo deleted' });
    },
    onError: (error) => {
      console.error('Error deleting photo:', error);
      toast({ title: 'Failed to delete photo', variant: 'destructive' });
    }
  });

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCamera(true);
      }
    } catch (error) {
      toast({ 
        title: 'Camera access denied', 
        description: 'Please allow camera access or upload a photo instead.',
        variant: 'destructive'
      });
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        setIsCamera(false);
        
        // Stop camera stream
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  };

  // Handle file selection
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

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cancel preview
  const handleCancel = () => {
    setCapturedImage(null);
    
    // Stop camera if active
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
    setIsCamera(false);
  };

  // Save photo
  const handleSavePhoto = async () => {
    if (!capturedImage || !user) return;

    setIsUploading(true);

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Generate unique filename
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const filePath = `${user.id}/${activityId}/extras/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('activity-photos')
        .upload(filePath, blob, { 
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('activity-photos')
        .getPublicUrl(filePath);

      // Get next sequence number
      const nextSequence = photos.length + 1;

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

      queryClient.invalidateQueries({ queryKey: ['activity-photos', activityId] });
      queryClient.invalidateQueries({ queryKey: ['activity-extra-photos', 'activity', activityId] });
      toast({ title: 'Photo saved' });

      setCapturedImage(null);

    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({ 
        title: 'Upload failed', 
        description: 'Failed to save the photo.',
        variant: 'destructive' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const canAddMore = photos.length < MAX_PHOTOS;

  return (
    <>
      <Card className="mt-6">
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
          {/* Camera Interface */}
          {isCamera && (
            <div className="space-y-3">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="h-4 w-4 mr-2" />
                  Capture
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Take/Load Photo Buttons */}
          {canAddMore && !capturedImage && !isCamera && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={startCamera}
                className="h-20 flex flex-col items-center justify-center gap-2"
                variant="outline"
              >
                <Camera className="h-5 w-5" />
                <span className="text-sm">Take Photo</span>
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="h-20 flex flex-col items-center justify-center gap-2"
                variant="outline"
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">Load Photo</span>
              </Button>
            </div>
          )}

          {/* Captured Image Preview with Save/Cancel */}
          {capturedImage && (
            <div className="space-y-3">
              <img 
                src={capturedImage} 
                alt="Captured photo" 
                className="w-full rounded-lg"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSavePhoto}
                  disabled={isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {/* Hidden canvas for camera capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Photo thumbnail grid */}
          {isLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((photo) => (
                <div 
                  key={photo.id} 
                  className="relative aspect-square group"
                >
                  <img
                    src={photo.thumb_url || photo.photo_url}
                    alt={photo.caption || 'Activity photo'}
                    className="w-full h-full object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => deleteMutation.mutate(photo.id)}
                    disabled={deleteMutation.isPending}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No additional photos yet
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default ActivityPhotoManager;