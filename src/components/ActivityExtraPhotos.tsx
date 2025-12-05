import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ImageIcon } from 'lucide-react';

interface ActivityExtraPhotosProps {
  activityId: string;
}

export const ActivityExtraPhotos = ({ activityId }: ActivityExtraPhotosProps) => {
  const { data: photos = [] } = useQuery({
    queryKey: ['activity-extra-photos', 'activity', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_photos')
        .select('id, photo_url, thumb_url, caption')
        .eq('activity_id', activityId)
        .order('sequence_number', { ascending: true })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
    enabled: !!activityId,
    staleTime: 30000
  });

  if (photos.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1 mb-1">
        <ImageIcon className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Photos</span>
      </div>
      <div className="flex gap-1">
        {photos.map((photo) => (
          <div 
            key={photo.id}
            className="relative w-8 h-8 rounded-sm border border-border/50 overflow-hidden bg-muted"
          >
            <img
              src={photo.thumb_url || photo.photo_url}
              alt={photo.caption || 'Activity photo'}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
