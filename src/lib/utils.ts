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
export function extractImageGPS(base64Image: string): { lat: number; lng: number } | null {
  try {
    // This is a simplified implementation - in production you'd use a proper EXIF library
    // For now, we'll return null to indicate no GPS data available
    // TODO: Implement proper EXIF extraction when needed
    return null;
  } catch (error) {
    console.warn('Failed to extract GPS from image:', error);
    return null;
  }
}
