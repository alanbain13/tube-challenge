import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractImageGPS, extractImageTimestamp } from '../utils';

// Mock the EXIF extraction functions
vi.mock('../utils', async () => {
  const actual = await vi.importActual('../utils');
  return {
    ...actual,
    extractImageGPS: vi.fn(),
    extractImageTimestamp: vi.fn(),
  };
});

const mockedExtractImageGPS = vi.mocked(extractImageGPS);
const mockedExtractImageTimestamp = vi.mocked(extractImageTimestamp);

// Simulated check-in pipeline that processes EXIF data and creates mutation payload
async function processCheckinWithEXIF(imageData: string, visitedAt: Date) {
  const [gpsData, timestampData] = await Promise.all([
    extractImageGPS(imageData),
    extractImageTimestamp(imageData)
  ]);

  // Determine GPS source and coordinates
  let latitude = null;
  let longitude = null;
  let gpsSource = 'device'; // Default fallback

  if (gpsData) {
    latitude = gpsData.lat;
    longitude = gpsData.lng;
    gpsSource = 'exif';
  }

  // Determine capture timestamp and flags
  let capturedAt = visitedAt; // Default fallback
  let exifTimePresent = false;
  let exifGpsPresent = false;

  if (timestampData) {
    capturedAt = timestampData;
    exifTimePresent = true;
  }

  if (gpsData) {
    exifGpsPresent = true;
  }

  // Create mutation payload
  return {
    visited_at: visitedAt,
    captured_at: capturedAt,
    exif_time_present: exifTimePresent,
    exif_gps_present: exifGpsPresent,
    latitude,
    longitude,
    gps_source: gpsSource,
    verification_image_url: 'mock-url',
    status: 'verified'
  };
}

describe('Check-in Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('EXIF data processing', () => {
    it('should create payload with EXIF GPS and timestamp when both present', async () => {
      const testDate = new Date('2025-09-24T12:00:00Z');
      const exifDate = new Date('2025-09-24T11:55:00Z');
      const gpsCoords = { lat: 51.5074, lng: -0.1278 };

      // Mock EXIF extraction to return data
      mockedExtractImageGPS.mockResolvedValue(gpsCoords);
      mockedExtractImageTimestamp.mockResolvedValue(exifDate);

      const payload = await processCheckinWithEXIF('mock-image-data', testDate);

      expect(payload).toEqual({
        visited_at: testDate,
        captured_at: exifDate,
        exif_time_present: true,
        exif_gps_present: true,
        latitude: 51.5074,
        longitude: -0.1278,
        gps_source: 'exif',
        verification_image_url: 'mock-url',
        status: 'verified'
      });
    });

    it('should use fallback values when GPS missing but timestamp present', async () => {
      const testDate = new Date('2025-09-24T12:00:00Z');
      const exifDate = new Date('2025-09-24T11:55:00Z');

      // Mock EXIF extraction - GPS missing, timestamp present
      mockedExtractImageGPS.mockResolvedValue(null);
      mockedExtractImageTimestamp.mockResolvedValue(exifDate);

      const payload = await processCheckinWithEXIF('mock-image-data', testDate);

      expect(payload).toEqual({
        visited_at: testDate,
        captured_at: exifDate,
        exif_time_present: true,
        exif_gps_present: false,
        latitude: null,
        longitude: null,
        gps_source: 'device',
        verification_image_url: 'mock-url',
        status: 'verified'
      });
    });

    it('should use fallback values when timestamp missing but GPS present', async () => {
      const testDate = new Date('2025-09-24T12:00:00Z');
      const gpsCoords = { lat: 51.5074, lng: -0.1278 };

      // Mock EXIF extraction - timestamp missing, GPS present
      mockedExtractImageGPS.mockResolvedValue(gpsCoords);
      mockedExtractImageTimestamp.mockResolvedValue(null);

      const payload = await processCheckinWithEXIF('mock-image-data', testDate);

      expect(payload).toEqual({
        visited_at: testDate,
        captured_at: testDate, // Fallback to visited_at
        exif_time_present: false,
        exif_gps_present: true,
        latitude: 51.5074,
        longitude: -0.1278,
        gps_source: 'exif',
        verification_image_url: 'mock-url',
        status: 'verified'
      });
    });

    it('should use all fallback values when no EXIF data present', async () => {
      const testDate = new Date('2025-09-24T12:00:00Z');

      // Mock EXIF extraction to return null for both
      mockedExtractImageGPS.mockResolvedValue(null);
      mockedExtractImageTimestamp.mockResolvedValue(null);

      const payload = await processCheckinWithEXIF('mock-image-data', testDate);

      expect(payload).toEqual({
        visited_at: testDate,
        captured_at: testDate, // Fallback to visited_at
        exif_time_present: false,
        exif_gps_present: false,
        latitude: null,
        longitude: null,
        gps_source: 'device',
        verification_image_url: 'mock-url',
        status: 'verified'
      });
    });
  });

  describe('EXIF extraction error handling', () => {
    it('should handle GPS extraction errors gracefully', async () => {
      const testDate = new Date('2025-09-24T12:00:00Z');
      
      // Mock GPS extraction to throw error
      mockedExtractImageGPS.mockRejectedValue(new Error('GPS extraction failed'));
      mockedExtractImageTimestamp.mockResolvedValue(null);

      const payload = await processCheckinWithEXIF('mock-image-data', testDate);

      expect(payload.exif_gps_present).toBe(false);
      expect(payload.gps_source).toBe('device');
      expect(payload.latitude).toBeNull();
      expect(payload.longitude).toBeNull();
    });

    it('should handle timestamp extraction errors gracefully', async () => {
      const testDate = new Date('2025-09-24T12:00:00Z');
      
      // Mock timestamp extraction to throw error
      mockedExtractImageGPS.mockResolvedValue(null);
      mockedExtractImageTimestamp.mockRejectedValue(new Error('Timestamp extraction failed'));

      const payload = await processCheckinWithEXIF('mock-image-data', testDate);

      expect(payload.exif_time_present).toBe(false);
      expect(payload.captured_at).toEqual(testDate);
    });
  });
});