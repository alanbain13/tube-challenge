import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ActivityExtraPhotosProps {
  activityId: string;
}

export const ActivityExtraPhotos = ({ activityId }: ActivityExtraPhotosProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: photos = [] } = useQuery({
    queryKey: ['activity-extra-photos', 'activity', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_photos')
        .select('id, photo_url, thumb_url, caption')
        .eq('activity_id', activityId)
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!activityId,
    staleTime: 30000
  });

  const displayPhotos = photos.slice(0, 3);
  const overflowCount = Math.max(0, photos.length - 3);

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') setLightboxOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, photos.length]);

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <>
      <div className="mt-2">
        <div className="flex items-center gap-1 mb-1">
          <ImageIcon className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Photos</span>
        </div>
        <div className="flex gap-1">
          {displayPhotos.map((photo, idx) => (
            <div 
              key={photo.id}
              className="relative w-8 h-8 rounded-sm border border-border/50 overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => openLightbox(idx)}
            >
              <img
                src={photo.thumb_url || photo.photo_url}
                alt={photo.caption || 'Activity photo'}
                className="w-full h-full object-cover"
              />
              {/* Show +N badge on 3rd thumbnail if overflow */}
              {idx === 2 && overflowCount > 0 && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white font-bold text-xs">+{overflowCount}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black border-0">
          <div className="relative">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Full-size image */}
            {currentPhoto ? (
              <img 
                src={currentPhoto.photo_url} 
                alt={currentPhoto.caption || 'Activity photo'}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            ) : (
              <div className="w-full h-[80vh] flex items-center justify-center">
                <div className="text-white/50 text-center">
                  <p>Image not available</p>
                </div>
              </div>
            )}
            
            {/* Navigation arrows */}
            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
            
            {/* Image info overlay */}
            {currentPhoto && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 text-white">
                {currentPhoto.caption && (
                  <div className="text-lg font-semibold">{currentPhoto.caption}</div>
                )}
                <div className="text-xs text-white/60 mt-2">
                  {currentIndex + 1} of {photos.length}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
