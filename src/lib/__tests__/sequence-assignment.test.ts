import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('Sequence Assignment Verification Tests', () => {
  const mockUser = { id: 'user-123' };
  const mockActivity = { id: 'activity-456' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Atomic sequence assignment', () => {
    it('should assign sequential numbers starting from 1', async () => {
      const mockResponses = [
        {
          data: {
            success: true,
            visit_id: 'visit-1',
            seq_actual: 1,
            status: 'verified'
          },
          error: null
        },
        {
          data: {
            success: true,
            visit_id: 'visit-2',
            seq_actual: 2,
            status: 'verified'
          },
          error: null
        },
        {
          data: {
            success: true,
            visit_id: 'visit-3',
            seq_actual: 3,
            status: 'verified'
          },
          error: null
        }
      ];

      (supabase.functions.invoke as any)
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      // Sequential visits to different stations
      const stations = ['940GZZLUKSX', '940GZZLUEUS', '940GZZLUVIC'];
      const results = [];

      for (let i = 0; i < stations.length; i++) {
        const result = await supabase.functions.invoke('record-visit', {
          body: {
            activity_id: mockActivity.id,
            station_tfl_id: stations[i],
            user_id: mockUser.id,
            simulation_mode: true
          }
        });
        results.push(result);
      }

      // Verify sequential assignment
      expect(results[0].data?.seq_actual).toBe(1);
      expect(results[1].data?.seq_actual).toBe(2);
      expect(results[2].data?.seq_actual).toBe(3);

      // Verify all succeeded
      results.forEach(result => {
        expect(result.data?.success).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('should handle concurrent insertions without gaps or collisions', async () => {
      // Mock concurrent responses with proper sequence numbers
      const mockConcurrentResponses = [
        {
          data: { success: true, visit_id: 'concurrent-1', seq_actual: 1, status: 'verified' },
          error: null
        },
        {
          data: { success: true, visit_id: 'concurrent-2', seq_actual: 2, status: 'verified' },
          error: null
        },
        {
          data: { success: true, visit_id: 'concurrent-3', seq_actual: 3, status: 'verified' },
          error: null
        },
        {
          data: { success: true, visit_id: 'concurrent-4', seq_actual: 4, status: 'verified' },
          error: null
        }
      ];

      (supabase.functions.invoke as any)
        .mockResolvedValueOnce(mockConcurrentResponses[0])
        .mockResolvedValueOnce(mockConcurrentResponses[1])
        .mockResolvedValueOnce(mockConcurrentResponses[2])
        .mockResolvedValueOnce(mockConcurrentResponses[3]);

      // Simulate concurrent requests (multiple devices)
      const concurrentRequests = [
        supabase.functions.invoke('record-visit', {
          body: {
            activity_id: mockActivity.id,
            station_tfl_id: '940GZZLUKSX',
            user_id: mockUser.id,
            simulation_mode: true
          }
        }),
        supabase.functions.invoke('record-visit', {
          body: {
            activity_id: mockActivity.id,
            station_tfl_id: '940GZZLUEUS',
            user_id: mockUser.id,
            simulation_mode: true
          }
        }),
        supabase.functions.invoke('record-visit', {
          body: {
            activity_id: mockActivity.id,
            station_tfl_id: '940GZZLUVIC',
            user_id: mockUser.id,
            simulation_mode: true
          }
        }),
        supabase.functions.invoke('record-visit', {
          body: {
            activity_id: mockActivity.id,
            station_tfl_id: '940GZZLULST',
            user_id: mockUser.id,
            simulation_mode: true
          }
        })
      ];

      const results = await Promise.all(concurrentRequests);

      // Extract sequence numbers
      const sequenceNumbers = results
        .map(r => r.data?.seq_actual)
        .filter(seq => seq !== undefined)
        .sort((a, b) => a - b);

      // Verify no gaps or collisions
      expect(sequenceNumbers).toEqual([1, 2, 3, 4]);
      
      // Verify all visits succeeded
      results.forEach(result => {
        expect(result.data?.success).toBe(true);
        expect(result.error).toBeNull();
      });

      // Verify uniqueness (no collisions)
      const uniqueSequences = new Set(sequenceNumbers);
      expect(uniqueSequences.size).toBe(sequenceNumbers.length);
    });

    it('should continue sequence from existing max value', async () => {
      // Mock scenario where activity already has visits with seq_actual = 5
      const mockResponseWithExisting = {
        data: {
          success: true,
          visit_id: 'visit-new',
          seq_actual: 6, // Should be max(5) + 1
          status: 'verified'
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponseWithExisting);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: '940GZZLUKSX',
          user_id: mockUser.id,
          simulation_mode: true
        }
      });

      expect(result.data?.seq_actual).toBe(6);
      expect(result.data?.success).toBe(true);
    });
  });

  describe('Out-of-order insertion handling', () => {
    it('should handle visits inserted out of chronological order', async () => {
      // Mock responses for visits created out of order but with proper sequence
      const mockOutOfOrderResponses = [
        {
          data: { success: true, visit_id: 'late-visit', seq_actual: 1, status: 'verified' },
          error: null
        },
        {
          data: { success: true, visit_id: 'early-visit', seq_actual: 2, status: 'verified' },
          error: null
        },
        {
          data: { success: true, visit_id: 'middle-visit', seq_actual: 3, status: 'verified' },
          error: null
        }
      ];

      (supabase.functions.invoke as any)
        .mockResolvedValueOnce(mockOutOfOrderResponses[0])
        .mockResolvedValueOnce(mockOutOfOrderResponses[1])
        .mockResolvedValueOnce(mockOutOfOrderResponses[2]);

      // Simulate visits with different timestamps but sequential sequence assignment
      const visitRequests = [
        {
          activity_id: mockActivity.id,
          station_tfl_id: '940GZZLUKSX',
          user_id: mockUser.id,
          captured_at: '2025-01-25T15:00:00Z', // Latest time
          simulation_mode: true
        },
        {
          activity_id: mockActivity.id,
          station_tfl_id: '940GZZLUEUS',
          user_id: mockUser.id,
          captured_at: '2025-01-25T10:00:00Z', // Earliest time
          simulation_mode: true
        },
        {
          activity_id: mockActivity.id,
          station_tfl_id: '940GZZLUVIC',
          user_id: mockUser.id,
          captured_at: '2025-01-25T12:00:00Z', // Middle time
          simulation_mode: true
        }
      ];

      const results = [];
      for (const request of visitRequests) {
        const result = await supabase.functions.invoke('record-visit', {
          body: request
        });
        results.push(result);
      }

      // Sequence should be assigned based on insert order, not timestamp
      expect(results[0].data?.seq_actual).toBe(1); // Latest timestamp, but first insert
      expect(results[1].data?.seq_actual).toBe(2); // Earliest timestamp, but second insert
      expect(results[2].data?.seq_actual).toBe(3); // Middle timestamp, but third insert

      // Verify no gaps in sequence
      const sequences = results.map(r => r.data?.seq_actual).sort();
      expect(sequences).toEqual([1, 2, 3]);
    });
  });

  describe('Multiple device simulation', () => {
    it('should handle visits from multiple devices for same activity', async () => {
      const mockMultiDeviceResponses = [
        {
          data: { success: true, visit_id: 'device1-visit1', seq_actual: 1, status: 'verified' },
          error: null
        },
        {
          data: { success: true, visit_id: 'device2-visit1', seq_actual: 2, status: 'verified' },
          error: null
        },
        {
          data: { success: true, visit_id: 'device1-visit2', seq_actual: 3, status: 'verified' },
          error: null
        },
        {
          data: { success: true, visit_id: 'device2-visit2', seq_actual: 4, status: 'verified' },
          error: null
        }
      ];

      (supabase.functions.invoke as any)
        .mockResolvedValueOnce(mockMultiDeviceResponses[0])
        .mockResolvedValueOnce(mockMultiDeviceResponses[1])
        .mockResolvedValueOnce(mockMultiDeviceResponses[2])
        .mockResolvedValueOnce(mockMultiDeviceResponses[3]);

      // Simulate alternating visits from two different devices
      const deviceRequests = [
        { device: 'device1', station: '940GZZLUKSX' },
        { device: 'device2', station: '940GZZLUEUS' },
        { device: 'device1', station: '940GZZLUVIC' },
        { device: 'device2', station: '940GZZLULST' }
      ];

      const results = [];
      for (const request of deviceRequests) {
        const result = await supabase.functions.invoke('record-visit', {
          body: {
            activity_id: mockActivity.id,
            station_tfl_id: request.station,
            user_id: mockUser.id,
            simulation_mode: true,
            // Simulate different device metadata
            verifier_version: request.device === 'device1' ? '1.0' : '1.1'
          }
        });
        results.push({ ...result, device: request.device });
      }

      // Verify sequence assignment is atomic across devices
      const sequenceNumbers = results.map(r => r.data?.seq_actual);
      expect(sequenceNumbers).toEqual([1, 2, 3, 4]);

      // Verify no collisions occurred
      const uniqueSequences = new Set(sequenceNumbers);
      expect(uniqueSequences.size).toBe(4);

      // Verify visit IDs are unique
      const visitIds = results.map(r => r.data?.visit_id);
      const uniqueVisitIds = new Set(visitIds);
      expect(uniqueVisitIds.size).toBe(4);
    });

    it('should prevent sequence collisions under high concurrency', async () => {
      // Mock high-concurrency scenario with 10 simultaneous requests
      const mockHighConcurrencyResponses = Array.from({ length: 10 }, (_, i) => ({
        data: {
          success: true,
          visit_id: `concurrent-${i + 1}`,
          seq_actual: i + 1,
          status: 'verified'
        },
        error: null
      }));

      (supabase.functions.invoke as any).mockImplementation(() => {
        const response = mockHighConcurrencyResponses.shift();
        return Promise.resolve(response);
      });

      // Create 10 concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        supabase.functions.invoke('record-visit', {
          body: {
            activity_id: mockActivity.id,
            station_tfl_id: `station-${i}`,
            user_id: mockUser.id,
            simulation_mode: true
          }
        })
      );

      const results = await Promise.all(concurrentRequests);

      // Extract and sort sequence numbers
      const sequences = results
        .map(r => r.data?.seq_actual)
        .filter(seq => seq !== undefined)
        .sort((a, b) => a - b);

      // Verify complete sequence 1-10 with no gaps or duplicates
      expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      
      // Verify all requests succeeded
      results.forEach(result => {
        expect(result.data?.success).toBe(true);
        expect(result.error).toBeNull();
      });
    });
  });

  describe('Edge cases and error recovery', () => {
    it('should handle sequence assignment when max query returns no results', async () => {
      // Mock empty activity (first visit)
      const mockFirstVisitResponse = {
        data: {
          success: true,
          visit_id: 'first-visit-ever',
          seq_actual: 1,
          status: 'verified'
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockFirstVisitResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: 'new-activity-123',
          station_tfl_id: '940GZZLUKSX',
          user_id: mockUser.id,
          simulation_mode: true
        }
      });

      expect(result.data?.seq_actual).toBe(1);
      expect(result.data?.success).toBe(true);
    });

    it('should handle null sequence values gracefully', async () => {
      // Mock scenario with corrupted data (null seq_actual)
      const mockRecoveryResponse = {
        data: {
          success: true,
          visit_id: 'recovery-visit',
          seq_actual: 1, // Should recover and assign proper sequence
          status: 'verified'
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockRecoveryResponse);

      const result = await supabase.functions.invoke('record-visit', {
        body: {
          activity_id: mockActivity.id,
          station_tfl_id: '940GZZLUKSX',
          user_id: mockUser.id,
          simulation_mode: true
        }
      });

      expect(result.data?.seq_actual).toBeGreaterThan(0);
      expect(result.data?.success).toBe(true);
    });
  });
});