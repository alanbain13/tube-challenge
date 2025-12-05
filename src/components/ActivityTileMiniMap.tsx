import { MiniMapSnapshot } from './MiniMapSnapshot';
import { RoundelGallery } from './RoundelGallery';
import { ActivityExtraPhotos } from './ActivityExtraPhotos';
import { useActivityState } from '@/hooks/useActivityState';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ActivityTileMiniMapProps {
  activityId: string;
  updatedAt: string;
  challengeId?: string | null;
}

export const ActivityTileMiniMap = ({ activityId, updatedAt, challengeId }: ActivityTileMiniMapProps) => {
  const { data: activityState, isLoading } = useActivityState(activityId);

  // Fetch challenge to get isSequenced flag
  const { data: challenge } = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: async () => {
      if (!challengeId) return null;
      const { data } = await supabase
        .from('challenges')
        .select('is_sequenced')
        .eq('id', challengeId)
        .maybeSingle();
      return data;
    },
    enabled: !!challengeId
  });

  if (isLoading || !activityState) {
    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted animate-pulse" />
    );
  }

  const visitedStations = (activityState.visited || []).map(v => ({
    station_tfl_id: v.station_tfl_id,
    seq_actual: v.seq_actual || 0
  }));

  const remainingStations = (activityState.remaining || []).map(r => ({
    station_tfl_id: r.station_tfl_id,
    seq_planned: r.seq_planned || 0
  }));

  // Determine if sequenced: default to true unless challenge explicitly sets it to false
  const isSequenced = challenge?.is_sequenced !== false;

  return (
    <div>
      <MiniMapSnapshot
        type="activity"
        id={activityId}
        visitedStations={visitedStations}
        remainingStations={remainingStations}
        lastVisitAt={updatedAt}
        isSequenced={isSequenced}
      />
      <RoundelGallery type="activity" id={activityId} />
      <ActivityExtraPhotos activityId={activityId} />
    </div>
  );
};
