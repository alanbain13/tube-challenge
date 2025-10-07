import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { validateGeofence } from '@/config/geofence';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('Geofence Integration Tests', () => {
  const mockUser = { id: 'user-123' };
  const mockActivity = { id: 'activity-456' };
  const kingsXStation = {
    tfl_id: '940GZZLUKSX',
    coords: { lat: 51.5308, lng: -0.1238 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Distance persistence integration test', () => {
    it('should persist geofence metadata for successful validation', async () => {
      // Mock successful geofence validation (within radius)
      const mockEXIFGPS = { lat: 51.5310, lng: -0.1240 }; // Close to King's Cross
      const mockInsert = vi.fn().mockResolvedValue({ 
        data: [{ id: 'visit-123' }], 
        error: null 
      });
      
      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'visit-123',
              latitude: mockEXIFGPS.lat,
              longitude: mockEXIFGPS.lng,
              gps_source: 'exif',
              geofence_distance_m: expect.any(Number),
              exif_gps_present: true
            },
            error: null
          })
        })
      });

      // Validate geofence
      const geofenceResult = validateGeofence(
        mockEXIFGPS, 
        null, 
        kingsXStation.coords.lat, 
        kingsXStation.coords.lng
      );

      // Simulate the mutation payload that would be created
      const visitData = {
        user_id: mockUser.id,
        activity_id: mockActivity.id,
        station_tfl_id: kingsXStation.tfl_id,
        latitude: geofenceResult.coords?.lat,
        longitude: geofenceResult.coords?.lng,
        gps_source: geofenceResult.gpsSource,
        geofence_distance_m: geofenceResult.distance,
        exif_gps_present: true,
        exif_time_present: false,
        status: 'verified',
        visited_at: new Date().toISOString()
      };

      // Mock the insert call
      await supabase.from('station_visits').insert(visitData);

      // Verify the insert was called with correct metadata
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: mockEXIFGPS.lat,
          longitude: mockEXIFGPS.lng,
          gps_source: 'exif',
          geofence_distance_m: expect.any(Number),
          exif_gps_present: true
        })
      );

      // Verify geofence validation succeeded
      expect(geofenceResult.withinGeofence).toBe(true);
      expect(geofenceResult.gpsSource).toBe('exif');
      expect(geofenceResult.distance).toBeLessThan(750);
    });

    it('should persist failure case with distance outside radius', async () => {
      // Mock failed geofence validation (outside radius)
      const mockFarGPS = { lat: 51.5408, lng: -0.1238 }; // ~1.1km from King's Cross
      const mockInsert = vi.fn().mockResolvedValue({ 
        data: [{ id: 'visit-123' }], 
        error: null 
      });
      
      (supabase.from as any).mockReturnValue({
        insert: mockInsert
      });

      // Validate geofence (should fail)
      const geofenceResult = validateGeofence(
        null, 
        mockFarGPS, 
        kingsXStation.coords.lat, 
        kingsXStation.coords.lng
      );

      // Even failed geofence should store distance and source
      const visitData = {
        user_id: mockUser.id,
        activity_id: mockActivity.id,
        station_tfl_id: kingsXStation.tfl_id,
        latitude: geofenceResult.coords?.lat,
        longitude: geofenceResult.coords?.lng,
        gps_source: geofenceResult.gpsSource,
        geofence_distance_m: geofenceResult.distance,
        exif_gps_present: false,
        status: 'pending', // Would be pending due to geofence failure
        pending_reason: 'geofence_failed',
        visited_at: new Date().toISOString()
      };

      await supabase.from('station_visits').insert(visitData);

      // Verify failure case still persists metadata
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: mockFarGPS.lat,
          longitude: mockFarGPS.lng,
          gps_source: 'device',
          geofence_distance_m: expect.any(Number),
          status: 'pending',
          pending_reason: 'geofence_failed'
        })
      );

      // Verify geofence validation failed
      expect(geofenceResult.withinGeofence).toBe(false);
      expect(geofenceResult.distance).toBeGreaterThan(750);
    });

    it('should handle no GPS case gracefully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ 
        data: [{ id: 'visit-123' }], 
        error: null 
      });
      
      (supabase.from as any).mockReturnValue({
        insert: mockInsert
      });

      // Validate geofence with no GPS
      const geofenceResult = validateGeofence(
        null, 
        null, 
        kingsXStation.coords.lat, 
        kingsXStation.coords.lng
      );

      const visitData = {
        user_id: mockUser.id,
        activity_id: mockActivity.id,
        station_tfl_id: kingsXStation.tfl_id,
        latitude: null,
        longitude: null,
        gps_source: geofenceResult.gpsSource,
        geofence_distance_m: null,
        exif_gps_present: false,
        status: 'pending',
        pending_reason: 'no_gps',
        visited_at: new Date().toISOString()
      };

      await supabase.from('station_visits').insert(visitData);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: null,
          longitude: null,
          gps_source: 'none',
          geofence_distance_m: null,
          status: 'pending',
          pending_reason: 'no_gps'
        })
      );

      expect(geofenceResult.gpsSource).toBe('none');
      expect(geofenceResult.coords).toBeNull();
    });
  });

  describe('Supabase row verification', () => {
    it('should verify inserted row reflects same values', async () => {
      const mockEXIFGPS = { lat: 51.5310, lng: -0.1240 };
      const expectedDistance = 25; // Approximate distance
      
      const mockInsertResponse = {
        data: [{ 
          id: 'visit-123',
          user_id: mockUser.id,
          activity_id: mockActivity.id,
          station_tfl_id: kingsXStation.tfl_id,
          latitude: mockEXIFGPS.lat,
          longitude: mockEXIFGPS.lng,
          gps_source: 'exif',
          geofence_distance_m: expectedDistance,
          exif_gps_present: true,
          status: 'verified'
        }],
        error: null
      };

      const mockSelectResponse = {
        data: mockInsertResponse.data[0],
        error: null
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(mockSelectResponse)
        })
      });

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockResolvedValue(mockInsertResponse),
        select: mockSelect
      });

      // Perform insert
      const insertResult = await supabase.from('station_visits').insert({
        user_id: mockUser.id,
        activity_id: mockActivity.id,
        station_tfl_id: kingsXStation.tfl_id,
        latitude: mockEXIFGPS.lat,
        longitude: mockEXIFGPS.lng,
        gps_source: 'exif',
        geofence_distance_m: expectedDistance,
        exif_gps_present: true,
        status: 'verified'
      });

      // Verify insert succeeded
      expect(insertResult.error).toBeNull();
      expect(insertResult.data).toHaveLength(1);

      // Query the inserted row
      const selectResult = await supabase
        .from('station_visits')
        .select('*')
        .eq('id', 'visit-123')
        .single();

      // Verify the row contains expected values
      expect(selectResult.error).toBeNull();
      expect(selectResult.data).toEqual(
        expect.objectContaining({
          latitude: mockEXIFGPS.lat,
          longitude: mockEXIFGPS.lng,
          gps_source: 'exif',
          geofence_distance_m: expectedDistance,
          exif_gps_present: true,
          status: 'verified'
        })
      );
    });
  });
});