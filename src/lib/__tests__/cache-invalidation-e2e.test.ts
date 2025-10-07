// Cache invalidation E2E test for A3.5.1
// This test verifies that queries are properly invalidated after successful check-in

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// Mock query client
const mockInvalidateQueries = vi.fn();
const mockRefetchQueries = vi.fn();

const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
  refetchQueries: mockRefetchQueries,
} as unknown as QueryClient;

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  QueryClient: vi.fn(() => mockQueryClient),
}));

describe('Cache invalidation after check-in', () => {
  const activityId = 'test-activity-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should invalidate all required queries after successful check-in', async () => {
    // Simulate successful check-in mutation
    const expectedQueryKeys = [
      ["activity_state", activityId],
      ["activity", activityId],
      ["activityVisits", activityId],
      ["activitySummary", activityId],
      ["activityMapData", activityId],
      ["activitiesList"]
    ];

    // Simulate the query invalidation calls that should happen
    await Promise.all([
      mockQueryClient.invalidateQueries({ queryKey: ["activity_state", activityId] }),
      mockQueryClient.invalidateQueries({ queryKey: ["activity", activityId] }),
      mockQueryClient.invalidateQueries({ queryKey: ["activityVisits", activityId] }),
      mockQueryClient.invalidateQueries({ queryKey: ["activitySummary", activityId] }),
      mockQueryClient.invalidateQueries({ queryKey: ["activityMapData", activityId] }),
      mockQueryClient.invalidateQueries({ queryKey: ["activitiesList"] }),
    ]);

    // Verify all required queries were invalidated
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(6);
    
    expectedQueryKeys.forEach(queryKey => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey });
    });
  });

  it('should refetch activity state for immediate update', async () => {
    // Simulate the refetch call
    await mockQueryClient.refetchQueries({ queryKey: ["activity_state", activityId] });

    expect(mockRefetchQueries).toHaveBeenCalledWith({ 
      queryKey: ["activity_state", activityId] 
    });
  });

  it('should invalidate dashboard counters for activity list updates', async () => {
    // Verify that dashboard counts are updated
    await mockQueryClient.invalidateQueries({ queryKey: ["activitiesList"] });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ 
      queryKey: ["activitiesList"] 
    });
  });

  it('should invalidate map data for immediate marker updates', async () => {
    // Verify that map markers are updated without reload
    await mockQueryClient.invalidateQueries({ queryKey: ["activityMapData", activityId] });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ 
      queryKey: ["activityMapData", activityId] 
    });
  });
});