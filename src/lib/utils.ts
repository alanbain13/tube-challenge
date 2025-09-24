import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Haversine distance calculation in meters
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Extract EXIF GPS data from base64 image
export async function extractImageGPS(base64Image: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Import exifr dynamically to avoid issues with SSR
    const { parse } = await import('exifr');
    
    // Convert base64 to buffer
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Parse EXIF data
    const exifData = await parse(buffer, { gps: true });
    
    if (exifData?.latitude && exifData?.longitude) {
      return {
        lat: exifData.latitude,
        lng: exifData.longitude
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract GPS from image:', error);
    return null;
  }
}

// Extract EXIF timestamp data from base64 image
export async function extractImageTimestamp(base64Image: string): Promise<Date | null> {
  try {
    // Import exifr dynamically to avoid issues with SSR
    const { parse } = await import('exifr');
    
    // Convert base64 to buffer
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Parse EXIF data for timestamps
    const exifData = await parse(buffer, { 
      pick: ['DateTimeOriginal', 'DateTime', 'CreateDate'] 
    });
    
    // Try different timestamp fields in order of preference
    const timestamp = exifData?.DateTimeOriginal || 
                     exifData?.DateTime || 
                     exifData?.CreateDate;
    
    if (timestamp && timestamp instanceof Date) {
      return timestamp;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract timestamp from image:', error);
    return null;
  }
}
