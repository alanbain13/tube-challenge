import { MiniMapSnapshot } from './MiniMapSnapshot';
import { RoundelThumbnailStrip } from './RoundelThumbnailStrip';
import { useActivityState } from '@/hooks/useActivityState';

interface ActivityTileMiniMapProps {
  activityId: string;
  updatedAt: string;
}

export const ActivityTileMiniMap = ({ activityId, updatedAt }: ActivityTileMiniMapProps) => {
  const { data: activityState, isLoading } = useActivityState(activityId);

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

  return (
    <div>
      <MiniMapSnapshot
        type="activity"
        id={activityId}
        visitedStations={visitedStations}
        remainingStations={remainingStations}
        lastVisitAt={updatedAt}
      />
      <RoundelThumbnailStrip type="activity" id={activityId} />
    </div>
  );
};
