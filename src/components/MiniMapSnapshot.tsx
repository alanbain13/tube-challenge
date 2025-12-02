import { useMiniMapSnapshot } from '@/hooks/useMiniMapSnapshot';
import { Skeleton } from '@/components/ui/skeleton';

interface MiniMapSnapshotProps {
  type: 'route' | 'activity';
  id: string;
  stationSequence?: string[];
  visitedStations?: Array<{ station_tfl_id: string; seq_actual: number }>;
  remainingStations?: Array<{ station_tfl_id: string; seq_planned: number }>;
  lastVisitAt?: string | null;
  updatedAt?: string;
  isSequenced?: boolean; // For challenges: if false, don't draw planned paths
}

export const MiniMapSnapshot = (props: MiniMapSnapshotProps) => {
  const { snapshotUrl, isLoading, containerRef } = useMiniMapSnapshot(props);

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted"
      style={{ aspectRatio: '16/9' }}
    >
      {isLoading || !snapshotUrl ? (
        <Skeleton className="w-full h-full" />
      ) : (
        <img
          src={snapshotUrl}
          alt="Route map preview"
          loading="lazy"
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
};
