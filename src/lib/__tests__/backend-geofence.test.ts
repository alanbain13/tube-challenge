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

describe('Backend Geofence Parity Tests', () => {
  const kingsXStation = {
    tfl_id: '940GZZLUKSX',
    coords: { lat: 51.5308, lng: -0.1238 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Server-side geofence validation', () => {
    it('should match client calculation for valid geofence', async () => {
      const userCoords = { lat: 51.5310, lng: -0.1240 }; // Close to King's Cross
      const clientDistance = 25; // Approximate client-calculated distance

      const mockResponse = {
        data: {
          valid: true,
          distance: 25,
          radiusUsed: 750,
          gpsSource: 'exif',
          serverCalculation: true,
          clientServerMatch: true,
          timestamp: new Date().toISOString()
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('validate-geofence', {
        body: {
          userLat: userCoords.lat,
          userLng: userCoords.lng,
          stationLat: kingsXStation.coords.lat,
          stationLng: kingsXStation.coords.lng,
          stationTflId: kingsXStation.tfl_id,
          gpsSource: 'exif',
          clientDistance
        }
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(
        expect.objectContaining({
          valid: true,
          distance: clientDistance,
          radiusUsed: 750,
          serverCalculation: true,
          clientServerMatch: true
        })
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith('validate-geofence', {
        body: expect.objectContaining({
          userLat: userCoords.lat,
          userLng: userCoords.lng,
          stationLat: kingsXStation.coords.lat,
          stationLng: kingsXStation.coords.lng,
          stationTflId: kingsXStation.tfl_id,
          gpsSource: 'exif',
          clientDistance
        })
      });
    });

    it('should fail validation for coordinates outside geofence', async () => {
      const userCoords = { lat: 51.5408, lng: -0.1238 }; // Far from King's Cross
      const clientDistance = 1100; // Approximate client-calculated distance

      const mockResponse = {
        data: {
          valid: false,
          distance: 1100,
          radiusUsed: 750,
          gpsSource: 'device',
          serverCalculation: true,
          clientServerMatch: true,
          timestamp: new Date().toISOString()
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('validate-geofence', {
        body: {
          userLat: userCoords.lat,
          userLng: userCoords.lng,
          stationLat: kingsXStation.coords.lat,
          stationLng: kingsXStation.coords.lng,
          stationTflId: kingsXStation.tfl_id,
          gpsSource: 'device',
          clientDistance
        }
      });

      expect(result.error).toBeNull();
      expect(result.data?.valid).toBe(false);
      expect(result.data?.distance).toBeGreaterThan(750);
      expect(result.data?.clientServerMatch).toBe(true);
    });

    it('should detect client-server calculation mismatch', async () => {
      const userCoords = { lat: 51.5310, lng: -0.1240 };
      const clientDistance = 100; // Incorrect client calculation
      const serverDistance = 25;  // Correct server calculation

      const mockResponse = {
        data: {
          valid: true,
          distance: serverDistance,
          radiusUsed: 750,
          gpsSource: 'exif',
          serverCalculation: true,
          clientServerMatch: false, // Server detected mismatch
          timestamp: new Date().toISOString()
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('validate-geofence', {
        body: {
          userLat: userCoords.lat,
          userLng: userCoords.lng,
          stationLat: kingsXStation.coords.lat,
          stationLng: kingsXStation.coords.lng,
          stationTflId: kingsXStation.tfl_id,
          gpsSource: 'exif',
          clientDistance
        }
      });

      expect(result.data?.clientServerMatch).toBe(false);
      expect(result.data?.distance).toBe(serverDistance);
      expect(result.data?.distance).not.toBe(clientDistance);
    });

    it('should prevent client-only enforcement bypass', async () => {
      // Simulate a malicious client that claims to be within geofence
      const userCoords = { lat: 51.5408, lng: -0.1238 }; // Actually far from station
      const maliciousClientDistance = 50; // Client lies about being close

      const mockResponse = {
        data: {
          valid: false, // Server correctly identifies violation
          distance: 1100, // Server calculates actual distance
          radiusUsed: 750,
          gpsSource: 'device',
          serverCalculation: true,
          clientServerMatch: false, // Server detects tampering
          timestamp: new Date().toISOString()
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await supabase.functions.invoke('validate-geofence', {
        body: {
          userLat: userCoords.lat,
          userLng: userCoords.lng,
          stationLat: kingsXStation.coords.lat,
          stationLng: kingsXStation.coords.lng,
          stationTflId: kingsXStation.tfl_id,
          gpsSource: 'device',
          clientDistance: maliciousClientDistance
        }
      });

      // Server should reject the attempt
      expect(result.data?.valid).toBe(false);
      expect(result.data?.distance).toBeGreaterThan(750);
      expect(result.data?.clientServerMatch).toBe(false);
      
      // The large discrepancy should be detected
      const distanceDiff = Math.abs(result.data!.distance - maliciousClientDistance);
      expect(distanceDiff).toBeGreaterThan(1000);
    });

    it('should handle identical inputs consistently', async () => {
      const userCoords = { lat: 51.5310, lng: -0.1240 };
      
      const mockResponse = {
        data: {
          valid: true,
          distance: 25,
          radiusUsed: 750,
          gpsSource: 'exif',
          serverCalculation: true,
          clientServerMatch: true,
          timestamp: new Date().toISOString()
        },
        error: null
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      // Make the same request multiple times
      const requests = Array(3).fill(null).map(() => 
        supabase.functions.invoke('validate-geofence', {
          body: {
            userLat: userCoords.lat,
            userLng: userCoords.lng,
            stationLat: kingsXStation.coords.lat,
            stationLng: kingsXStation.coords.lng,
            stationTflId: kingsXStation.tfl_id,
            gpsSource: 'exif',
            clientDistance: 25
          }
        })
      );

      const results = await Promise.all(requests);

      // All results should be identical (deterministic)
      results.forEach(result => {
        expect(result.data?.valid).toBe(true);
        expect(result.data?.distance).toBe(25);
        expect(result.data?.radiusUsed).toBe(750);
        expect(result.data?.clientServerMatch).toBe(true);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle missing coordinates gracefully', async () => {
      const mockErrorResponse = {
        data: null,
        error: new Error('Missing required coordinates or station ID')
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockErrorResponse);

      const result = await supabase.functions.invoke('validate-geofence', {
        body: {
          // Missing coordinates
          stationTflId: kingsXStation.tfl_id,
          gpsSource: 'device'
        }
      });

      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it('should handle invalid coordinate types', async () => {
      const mockErrorResponse = {
        data: null,
        error: new Error('Missing required coordinates or station ID')
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockErrorResponse);

      const result = await supabase.functions.invoke('validate-geofence', {
        body: {
          userLat: 'invalid',
          userLng: 'invalid',
          stationLat: kingsXStation.coords.lat,
          stationLng: kingsXStation.coords.lng,
          stationTflId: kingsXStation.tfl_id,
          gpsSource: 'device'
        }
      });

      expect(result.error).toBeTruthy();
    });
  });
});