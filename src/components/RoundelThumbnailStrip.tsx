import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStations } from '@/hooks/useStations';
import { useEffect, useState } from 'react';
import { getThumbnailFromCache, saveThumbnailToCache } from '@/lib/thumbnailCache';
import { generateThumbnail } from '@/lib/thumbnailGenerator';
import roundelFilled from '@/assets/roundel-filled.svg';

interface RoundelThumbnailStripProps {
  type: 'activity' | 'route';
  id: string;
}

interface ThumbnailData {
  url: string | null;
  stationName: string;
  visitId?: string;
  needsGeneration?: boolean;
}

export const RoundelThumbnailStrip = ({ type, id }: RoundelThumbnailStripProps) => {
  const { stations } = useStations();
  const [generatedThumbs, setGeneratedThumbs] = useState<Map<string, string>>(new Map());

  const { data: thumbnails = [] } = useQuery({
    queryKey: ['roundel-thumbnails', type, id],
    queryFn: async () => {
      if (type === 'activity') {
        // For activities: query station_visits
        const { data, error } = await supabase
          .from('station_visits')
          .select('id, station_tfl_id, thumb_url, verification_image_url, captured_at')
          .eq('activity_id', id)
          .in('status', ['verified', 'pending'])
          .order('captured_at', { ascending: false })
          .limit(3);

        if (error) throw error;

        return (data || []).map(visit => ({
          url: visit.thumb_url,
          stationName: stations.find(s => s.id === visit.station_tfl_id)?.name || visit.station_tfl_id,
          visitId: visit.id,
          needsGeneration: !visit.thumb_url && !!visit.verification_image_url
        }));
      } else {
        // For routes: get linked activities and their photos
        const { data: activities, error: actError } = await supabase
          .from('activities')
          .select('id')
          .eq('route_id', id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (actError) throw actError;
        if (!activities || activities.length === 0) return [];

        const activityIds = activities.map(a => a.id);
        
        const { data: visits, error: visitsError } = await supabase
          .from('station_visits')
          .select('id, station_tfl_id, thumb_url, verification_image_url, captured_at')
          .in('activity_id', activityIds)
          .in('status', ['verified', 'pending'])
          .order('captured_at', { ascending: false })
          .limit(3);

        if (visitsError) throw visitsError;

        return (visits || []).map(visit => ({
          url: visit.thumb_url,
          stationName: stations.find(s => s.id === visit.station_tfl_id)?.name || visit.station_tfl_id,
          visitId: visit.id,
          needsGeneration: !visit.thumb_url && !!visit.verification_image_url
        }));
      }
    },
    enabled: !!id,
    staleTime: 30000
  });

  // Generate missing thumbnails asynchronously
  useEffect(() => {
    const generateMissingThumbnails = async () => {
      for (const thumb of thumbnails) {
        if (thumb.needsGeneration && thumb.visitId && !generatedThumbs.has(thumb.visitId)) {
          try {
            // Check cache first
            const cached = await getThumbnailFromCache(thumb.visitId);
            if (cached) {
              console.log('[Tile.Snapshot.CacheHit]', thumb.visitId);
              setGeneratedThumbs(prev => new Map(prev).set(thumb.visitId!, cached));
              continue;
            }

            console.log('[Tile.Snapshot.CacheMiss]', thumb.visitId);

            // Generate from full image
            const { data: visit } = await supabase
              .from('station_visits')
              .select('verification_image_url')
              .eq('id', thumb.visitId)
              .single();

            if (visit?.verification_image_url) {
              const generated = await generateThumbnail(visit.verification_image_url);
              await saveThumbnailToCache(thumb.visitId, generated);
              setGeneratedThumbs(prev => new Map(prev).set(thumb.visitId!, generated));
            }
          } catch (error) {
            console.error('[Tile.Thumb] Generation failed:', thumb.visitId, error);
          }
        }
      }
    };

    if (thumbnails.length > 0) {
      generateMissingThumbnails();
    }
  }, [thumbnails, generatedThumbs]);

  // Fill remaining slots with placeholders
  const placeholderCount = Math.max(0, 3 - thumbnails.length);
  const placeholders = Array(placeholderCount).fill(null);
  
  if (placeholderCount > 0) {
    console.log('[Tile.Thumb.PlaceholderUsed]', placeholderCount);
  }

  return (
    <div className="flex items-center gap-1.5 mt-2">
      {thumbnails.map((thumb, idx) => {
        const displayUrl = thumb.url || (thumb.visitId ? generatedThumbs.get(thumb.visitId) : null);
        
        return (
          <div 
            key={`thumb-${idx}`}
            className="relative w-7 h-7 rounded-md border border-border/50 overflow-hidden bg-muted"
          >
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={`${thumb.stationName} roundel photo`}
                loading="lazy"
                width={28}
                height={28}
                className="w-full h-full object-cover"
                srcSet={`${displayUrl} 1x, ${displayUrl} 2x`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <img 
                  src={roundelFilled}
                  alt={`${thumb.stationName} placeholder`}
                  className="w-4 h-4 opacity-30"
                />
              </div>
            )}
          </div>
        );
      })}
      {placeholders.map((_, idx) => (
        <div 
          key={`placeholder-${idx}`}
          className="relative w-7 h-7 rounded-md border border-border/30 bg-muted/30 flex items-center justify-center"
        >
          <img 
            src={roundelFilled}
            alt="No photo yet"
            className="w-3.5 h-3.5 opacity-20"
          />
        </div>
      ))}
    </div>
  );
};
