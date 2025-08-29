import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityPlanItem {
  station_tfl_id: string;
  seq_planned: number;
  line_hint?: string;
}

export interface StationVisit {
  station_tfl_id: string;
  seq_actual: number;
  status: 'verified' | 'pending' | 'rejected';
  visited_at: string;
}

export interface UnifiedActivityState {
  activityId: string;
  mode: 'planned' | 'unplanned';
  visited: StationVisit[];
  remaining?: ActivityPlanItem[]; // Only for planned activities
  visitedCount: number;
  totalPlannedCount: number;
}

/**
 * Unified activity state hook that provides consistent derived state
 * for both planned and unplanned activities across all components
 */
export const useActivityState = (activityId?: string) => {
  return useQuery({
    queryKey: ['activity-state', activityId],
    queryFn: async (): Promise<UnifiedActivityState> => {
      if (!activityId) throw new Error('Activity ID required');

      // Get activity plan items (for planned activities)
      const { data: planItems, error: planError } = await supabase
        .from('activity_plan_item')
        .select('station_tfl_id, seq_planned, line_hint')
        .eq('activity_id', activityId)
        .order('seq_planned', { ascending: true });

      if (planError) throw planError;

      // Get station visits (verified and pending only)
      const { data: visits, error: visitsError } = await supabase
        .from('station_visits')
        .select('station_tfl_id, sequence_number, status, visited_at')
        .eq('activity_id', activityId)
        .in('status', ['verified', 'pending'])
        .order('visited_at', { ascending: true });

      if (visitsError) throw visitsError;

      // Convert visits with proper seq_actual (chronological order)
      const visited: StationVisit[] = (visits || []).map((visit, index) => ({
        station_tfl_id: visit.station_tfl_id,
        seq_actual: index + 1,
        status: visit.status as 'verified' | 'pending',
        visited_at: visit.visited_at
      }));

      const mode = (planItems && planItems.length > 0) ? 'planned' : 'unplanned';

      // For planned activities, calculate remaining stations
      let remaining: ActivityPlanItem[] | undefined;
      if (mode === 'planned') {
        const visitedStationIds = new Set(visited.map(v => v.station_tfl_id));
        remaining = (planItems || []).filter(
          item => !visitedStationIds.has(item.station_tfl_id)
        );
      }

      return {
        activityId,
        mode,
        visited,
        remaining,
        visitedCount: visited.length,
        totalPlannedCount: planItems?.length || 0
      };
    },
    enabled: !!activityId,
    staleTime: 30000 // 30 seconds
  });
};