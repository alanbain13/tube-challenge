import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = async (imageData: string, fileName: string, bucket: string = 'verification'): Promise<{ imageUrl: string; thumbUrl: string } | null> => {
    try {
      setIsUploading(true);

      // Convert base64 to blob
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      // Upload full image to Supabase storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Image upload error:', error);
        toast({
          title: "Upload failed",
          description: error.message,
          variant: "destructive"
        });
        return null;
      }

      // Get public URL for full image
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      // Generate thumbnail filename
      const thumbFileName = fileName.replace('.jpg', '-thumb.jpg');
      
      // Create thumbnail (resize to 150x150)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const thumbUrl = await new Promise<string>((resolve, reject) => {
        img.onload = async () => {
          // Calculate thumbnail dimensions (maintaining aspect ratio)
          const maxSize = 150;
          const ratio = Math.min(maxSize / img.width, maxSize / img.height);
          const width = img.width * ratio;
          const height = img.height * ratio;
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to blob
          canvas.toBlob(async (thumbBlob) => {
            if (!thumbBlob) {
              reject(new Error('Failed to create thumbnail'));
              return;
            }
            
            // Upload thumbnail
            const { data: thumbData, error: thumbError } = await supabase.storage
              .from(bucket)
              .upload(thumbFileName, thumbBlob, {
                cacheControl: '3600',
                upsert: false
              });

            if (thumbError) {
              console.warn('Thumbnail upload failed, using full image:', thumbError);
              resolve(urlData.publicUrl); // Fallback to full image
              return;
            }

            // Get public URL for thumbnail
            const { data: thumbUrlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(thumbData.path);
              
            resolve(thumbUrlData.publicUrl);
          }, 'image/jpeg', 0.7);
        };
        
        img.onerror = () => {
          console.warn('Failed to load image for thumbnail creation');
          resolve(urlData.publicUrl); // Fallback to full image
        };
        
        img.src = imageData;
      });

      return {
        imageUrl: urlData.publicUrl,
        thumbUrl
      };

    } catch (error: any) {
      console.error('Image upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImage,
    isUploading
  };
};