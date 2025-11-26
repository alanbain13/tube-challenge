import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStations } from '@/hooks/useStations';
import { useEffect, useState } from 'react';
import { getThumbnailFromCache, saveThumbnailToCache } from '@/lib/thumbnailCache';
import { generateThumbnail } from '@/lib/thumbnailGenerator';
import roundelFilled from '@/assets/roundel-filled.svg';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';

interface RoundelGalleryProps {
  type: 'activity' | 'route';
  id: string;
}

interface GalleryItem {
  id: string;
  thumbUrl: string | null;
  fullImageUrl: string | null;
  stationName: string;
  capturedAt: string | null;
  stationTflId: string;
  needsGeneration?: boolean;
}

export const RoundelGallery = ({ type, id }: RoundelGalleryProps) => {
  const { stations } = useStations();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generatedThumbs, setGeneratedThumbs] = useState<Map<string, string>>(new Map());

  const { data: galleryItems = [], isLoading: isLoadingGallery } = useQuery<GalleryItem[]>({
    queryKey: ['roundel-gallery', type, id],
    queryFn: async () => {
      console.log('[RoundelGallery] Fetching gallery items', { type, id, stationsLoaded: stations.length });
      if (type === 'activity') {
        // For activities: query station_visits
        const { data, error } = await supabase
          .from('station_visits')
          .select('id, station_tfl_id, thumb_url, verification_image_url, captured_at')
          .eq('activity_id', id)
          .in('status', ['verified', 'pending'])
          .order('captured_at', { ascending: false });

        if (error) throw error;

        console.log('[RoundelGallery] Activity visits fetched:', data?.length || 0);

        return (data || []).map(visit => ({
          id: visit.id,
          thumbUrl: visit.thumb_url,
          fullImageUrl: visit.verification_image_url,
          stationName: stations.find(s => s.id === visit.station_tfl_id)?.displayName || visit.station_tfl_id,
          capturedAt: visit.captured_at,
          stationTflId: visit.station_tfl_id,
          needsGeneration: !visit.thumb_url && !!visit.verification_image_url
        }));
      } else {
        // For routes: get linked activities and their photos
        const { data: activities, error: actError } = await supabase
          .from('activities')
          .select('id')
          .eq('route_id', id)
          .order('created_at', { ascending: false });

        if (actError) throw actError;
        if (!activities || activities.length === 0) return [];

        const activityIds = activities.map(a => a.id);
        
        const { data: visits, error: visitsError } = await supabase
          .from('station_visits')
          .select('id, station_tfl_id, thumb_url, verification_image_url, captured_at')
          .in('activity_id', activityIds)
          .in('status', ['verified', 'pending'])
          .order('captured_at', { ascending: false });

        if (visitsError) throw visitsError;

        return (visits || []).map(visit => ({
          id: visit.id,
          thumbUrl: visit.thumb_url,
          fullImageUrl: visit.verification_image_url,
          stationName: stations.find(s => s.id === visit.station_tfl_id)?.displayName || visit.station_tfl_id,
          capturedAt: visit.captured_at,
          stationTflId: visit.station_tfl_id,
          needsGeneration: !visit.thumb_url && !!visit.verification_image_url
        }));
      }
    },
    enabled: !!id,  // Remove stations dependency - let query run and show loading state
    staleTime: 30000
  });

  // Generate missing thumbnails asynchronously
  useEffect(() => {
    const generateMissingThumbnails = async () => {
      for (const item of galleryItems) {
        if (item.needsGeneration && !generatedThumbs.has(item.id)) {
          try {
            const cached = await getThumbnailFromCache(item.id);
            if (cached) {
              setGeneratedThumbs(prev => new Map(prev).set(item.id, cached));
              continue;
            }

            if (item.fullImageUrl) {
              const generated = await generateThumbnail(item.fullImageUrl);
              await saveThumbnailToCache(item.id, generated);
              setGeneratedThumbs(prev => new Map(prev).set(item.id, generated));
            }
          } catch (error) {
            console.warn('[Gallery.Thumb] Generation failed, will use placeholder:', item.id, error);
            // Don't retry - just leave it to show the placeholder
          }
        }
      }
    };

    if (galleryItems.length > 0) {
      generateMissingThumbnails();
    }
  }, [galleryItems, generatedThumbs]);

  const displayThumbs = galleryItems.slice(0, 3);
  const overflowCount = Math.max(0, galleryItems.length - 3);
  const placeholderCount = Math.max(0, 3 - galleryItems.length);
  const placeholders = Array(placeholderCount).fill(null);

  console.log('[RoundelGallery] Render state:', {
    type,
    id,
    stationsLoaded: stations.length,
    isLoadingGallery,
    totalItems: galleryItems.length,
    displayThumbs: displayThumbs.length,
    placeholders: placeholderCount,
    generatedCount: generatedThumbs.size
  });

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : galleryItems.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < galleryItems.length - 1 ? prev + 1 : 0));
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
  }, [lightboxOpen, galleryItems.length]);

  const currentItem = galleryItems[currentIndex];

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mt-2">
      {displayThumbs.map((item, idx) => {
          const displayUrl = item.thumbUrl || generatedThumbs.get(item.id);
          console.log('[RoundelGallery] Rendering thumb', { idx, stationName: item.stationName, hasThumb: !!item.thumbUrl, hasGenerated: generatedThumbs.has(item.id), needsGen: item.needsGeneration });
          
          return (
            <div 
              key={item.id}
              className="relative aspect-square rounded-md border border-border/50 overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => openLightbox(idx)}
            >
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt={`${item.stationName} roundel`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <img 
                    src={roundelFilled}
                    alt={item.stationName}
                    className="w-1/3 h-1/3 opacity-30"
                  />
                </div>
              )}
              
              {/* Show +N badge on 3rd thumbnail if overflow */}
              {idx === 2 && overflowCount > 0 && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white font-bold text-sm">+{overflowCount}</span>
                </div>
              )}
            </div>
          );
        })}
        
        {placeholders.map((_, idx) => (
          <div 
            key={`placeholder-${idx}`}
            className="relative aspect-square rounded-md border border-border/30 bg-muted/30 flex items-center justify-center"
          >
            <img 
              src={roundelFilled}
              alt="No photo yet"
              className="w-1/3 h-1/3 opacity-20"
            />
          </div>
        ))}
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
            {currentItem?.fullImageUrl && (
              <img 
                src={currentItem.fullImageUrl} 
                alt={currentItem.stationName}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
            
            {/* Navigation arrows */}
            {galleryItems.length > 1 && (
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
            {currentItem && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 text-white">
                <div className="text-lg font-semibold">{currentItem.stationName}</div>
                {currentItem.capturedAt && (
                  <div className="text-sm text-white/80 mt-1">
                    {format(new Date(currentItem.capturedAt), 'PPpp')}
                  </div>
                )}
                <div className="text-xs text-white/60 mt-2">
                  {currentIndex + 1} of {galleryItems.length}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
