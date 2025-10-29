import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStations } from '@/hooks/useStations';
import roundelFilled from '@/assets/roundel-filled.svg';

interface RoundelThumbnailStripProps {
  type: 'activity' | 'route';
  id: string;
}

export const RoundelThumbnailStrip = ({ type, id }: RoundelThumbnailStripProps) => {
  const { stations } = useStations();

  const { data: thumbnails = [] } = useQuery({
    queryKey: ['roundel-thumbnails', type, id],
    queryFn: async () => {
      if (type === 'activity') {
        // For activities: query station_visits
        const { data, error } = await supabase
          .from('station_visits')
          .select('station_tfl_id, thumb_url, verification_image_url, captured_at')
          .eq('activity_id', id)
          .in('status', ['verified', 'pending'])
          .order('captured_at', { ascending: false })
          .limit(3);

        if (error) throw error;

        return (data || []).map(visit => ({
          url: visit.thumb_url || visit.verification_image_url,
          stationName: stations.find(s => s.id === visit.station_tfl_id)?.name || visit.station_tfl_id
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
          .select('station_tfl_id, thumb_url, verification_image_url, captured_at')
          .in('activity_id', activityIds)
          .in('status', ['verified', 'pending'])
          .order('captured_at', { ascending: false })
          .limit(3);

        if (visitsError) throw visitsError;

        return (visits || []).map(visit => ({
          url: visit.thumb_url || visit.verification_image_url,
          stationName: stations.find(s => s.id === visit.station_tfl_id)?.name || visit.station_tfl_id
        }));
      }
    },
    enabled: !!id,
    staleTime: 30000
  });

  // Fill remaining slots with placeholders
  const placeholderCount = Math.max(0, 3 - thumbnails.length);
  const placeholders = Array(placeholderCount).fill(null);

  return (
    <div className="flex items-center gap-1.5 mt-2">
      {thumbnails.map((thumb, idx) => (
        <div 
          key={`thumb-${idx}`}
          className="relative w-7 h-7 rounded-md border border-border/50 overflow-hidden bg-muted"
        >
          {thumb.url ? (
            <img
              src={thumb.url}
              alt={`${thumb.stationName} roundel photo`}
              loading="lazy"
              width={28}
              height={28}
              className="w-full h-full object-cover"
              srcSet={`${thumb.url} 1x, ${thumb.url} 2x`}
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
      ))}
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
