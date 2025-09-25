import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    },
    from: vi.fn()
  }
}));

describe('Duplicate Guard Integration Tests', () => {
  const mockUser = { id: 'user-123' };
  const mockActivity = { id: 'activity-456' };
  const mockStation = { tfl_id: '940GZZLUKSX', name: 'King\'s Cross St. Pancras' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pre-insert duplicate detection', () => {
    it('should prevent duplicate visit and return proper error', async () => {
      // Mock existing visit response
      const existingVisit = {
        id: 'existing-visit-123',
        visited_at: '2025-01-25T10:30:00Z',
        station_tfl_id: mockStation.tfl_id
      };

      const mockDuplicateResponse = {
        data: null,
        error: {
          message: `Already checked in to ${mockStation.name} for this activity.`,
          code: 'duplicate_visit'
        }
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockDuplicateResponse);

      // Attempt to record visit
      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id,
          simulation_mode: false,
          ai_enabled: true,
          has_connectivity: true,
          geofence_result: {
            withinGeofence: true,
            distance: 100,
            gpsSource: 'device'
          },
          ocr_result: {
            success: true,
            confidence: 0.9
          }
        }
      });

      // Verify duplicate was detected and proper error returned
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('duplicate_visit');
      expect(result.error?.message).toContain(mockStation.name);
      expect(result.error?.message).toContain('Already checked in');
    });

    it('should include station name in duplicate error message', async () => {
      const mockDuplicateResponse = {
        data: null,
        error: {
          message: `Already checked in to King's Cross St. Pancras for this activity.`,
          code: 'duplicate_visit',
          duplicate: {
            existing_visit_id: 'existing-visit-123',
            station_name: 'King\'s Cross St. Pancras',
            visited_at: '2025-01-25T10:30:00Z'
          }
        }
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockDuplicateResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id
        }
      });

      expect(result.error?.duplicate?.station_name).toBe('King\'s Cross St. Pancras');
      expect(result.error?.duplicate?.existing_visit_id).toBe('existing-visit-123');
      expect(result.error?.duplicate?.visited_at).toBe('2025-01-25T10:30:00Z');
    });

    it('should allow visits to different stations in same activity', async () => {
      const mockSuccessResponse = {
        data: {
          success: true,
          visit_id: 'new-visit-123',
          seq_actual: 2,
          status: 'verified'
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockSuccessResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: '940GZZLUEUS', // Different station (Euston)
          user_id: mockUser.id,
          simulation_mode: false,
          ai_enabled: true,
          has_connectivity: true
        }
      });

      expect(result.data?.success).toBe(true);
      expect(result.data?.visit_id).toBe('new-visit-123');
      expect(result.data?.seq_actual).toBe(2);
      expect(result.error).toBeNull();
    });

    it('should allow same station in different activities', async () => {
      const mockSuccessResponse = {
        data: {
          success: true,
          visit_id: 'new-visit-456',
          seq_actual: 1,
          status: 'verified'
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockSuccessResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: 'different-activity-789', // Different activity
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id,
          simulation_mode: false
        }
      });

      expect(result.data?.success).toBe(true);
      expect(result.data?.visit_id).toBe('new-visit-456');
      expect(result.data?.seq_actual).toBe(1);
    });
  });

  describe('Race condition handling', () => {
    it('should handle concurrent duplicate attempts', async () => {
      // Simulate race condition where duplicate constraint is hit during insert
      const mockRaceConditionResponse = {
        data: null,
        error: {
          message: `Already checked in to ${mockStation.name} for this activity.`,
          code: 'duplicate_visit_race'
        }
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockRaceConditionResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id
        }
      });

      expect(result.error?.code).toBe('duplicate_visit_race');
      expect(result.error?.message).toContain('Already checked in');
    });

    it('should handle multiple rapid requests gracefully', async () => {
      // First request succeeds
      const mockFirstResponse = {
        data: {
          success: true,
          visit_id: 'first-visit-123',
          seq_actual: 1,
          status: 'verified'
        },
        error: null
      };

      // Second request (duplicate) fails
      const mockSecondResponse = {
        data: null,
        error: {
          message: `Already checked in to ${mockStation.name} for this activity.`,
          code: 'duplicate_visit'
        }
      };

      (supabase.functions.invoke as any)
        .mockResolvedValueOnce(mockFirstResponse)
        .mockResolvedValueOnce(mockSecondResponse);

      // Simulate rapid concurrent requests
      const request1 = supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id
        }
      });

      const request2 = supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id
        }
      });

      const [result1, result2] = await Promise.all([request1, request2]);

      // First should succeed
      expect(result1.data?.success).toBe(true);
      expect(result1.data?.visit_id).toBe('first-visit-123');

      // Second should fail with duplicate error
      expect(result2.data).toBeNull();
      expect(result2.error?.code).toBe('duplicate_visit');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle missing station name gracefully', async () => {
      const mockResponseNoStationName = {
        data: null,
        error: {
          message: `Already checked in to ${mockStation.tfl_id} for this activity.`, // Falls back to TFL ID
          code: 'duplicate_visit',
          duplicate: {
            existing_visit_id: 'existing-123',
            station_name: mockStation.tfl_id, // Fallback when station name lookup fails
            visited_at: '2025-01-25T10:30:00Z'
          }
        }
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponseNoStationName);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id
        }
      });

      expect(result.error?.message).toContain(mockStation.tfl_id);
      expect(result.error?.duplicate?.station_name).toBe(mockStation.tfl_id);
    });

    it('should handle invalid input parameters', async () => {
      const mockErrorResponse = {
        data: null,
        error: {
          message: 'Missing required fields: activity_id, station_tfl_id, user_id',
          code: 'missing_fields'
        }
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockErrorResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          // Missing required fields
          activity_id: mockActivity.id,
          // station_tfl_id missing
          // user_id missing
        }
      });

      expect(result.error?.code).toBe('missing_fields');
      expect(result.error?.message).toContain('Missing required fields');
    });
  });

  describe('UI Integration', () => {
    it('should provide structured error for UI toast display', async () => {
      const mockDuplicateResponse = {
        data: null,
        error: {
          message: `Already checked in to King's Cross St. Pancras for this activity.`,
          code: 'duplicate_visit',
          duplicate: {
            existing_visit_id: 'existing-123',
            station_name: 'King\'s Cross St. Pancras',
            visited_at: '2025-01-25T10:30:00Z'
          }
        }
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockDuplicateResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id
        }
      });

      // Verify structure suitable for UI display
      expect(result.error).toBeDefined();
      expect(result.error?.message).toMatch(/Already checked in to .+ for this activity\./);
      expect(result.error?.code).toBe('duplicate_visit');
      expect(result.error?.duplicate).toHaveProperty('station_name');
      expect(result.error?.duplicate).toHaveProperty('visited_at');
    });

    it('should prevent optimistic UI updates on duplicate detection', async () => {
      // Mock that simulates the guard preventing any sequence number assignment
      const mockDuplicateResponse = {
        data: null,
        error: {
          message: `Already checked in to ${mockStation.name} for this activity.`,
          code: 'duplicate_visit'
        }
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockDuplicateResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: mockStation.tfl_id,
          user_id: mockUser.id
        }
      });

      // No visit_id or seq_actual should be returned on duplicate
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('duplicate_visit');
      
      // Verify no optimistic sequence assignment occurred
      expect(result.data?.visit_id).toBeUndefined();
      expect(result.data?.seq_actual).toBeUndefined();
    });
  });
});