import { useMiniMapSnapshot } from '@/hooks/useMiniMapSnapshot';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';

interface MiniMapSnapshotProps {
  type: 'route' | 'activity';
  id: string;
  stationSequence?: string[];
  visitedStations?: Array<{ station_tfl_id: string; seq_actual: number }>;
  remainingStations?: Array<{ station_tfl_id: string; seq_planned: number }>;
  lastVisitAt?: string | null;
  updatedAt?: string;
}

export const MiniMapSnapshot = (props: MiniMapSnapshotProps) => {
  const [mapboxToken, setMapboxToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Try to get Mapbox token from localStorage
    const token = localStorage.getItem('mapboxToken');
    if (token) {
      setMapboxToken(token);
    }
  }, []);

  const { snapshotUrl, isLoading, containerRef } = useMiniMapSnapshot({
    ...props,
    mapboxToken
  });

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
