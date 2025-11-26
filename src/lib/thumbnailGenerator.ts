/**
 * Generate client-side thumbnails from full images
 * Max width: 320px, maintains aspect ratio
 */

const MAX_THUMB_WIDTH = 320;

export async function generateThumbnail(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Handle data URIs without crossOrigin
    const isDataUri = imageUrl.startsWith('data:');
    
    const img = new Image();
    if (!isDataUri) {
      img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Calculate dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_THUMB_WIDTH) {
          const ratio = MAX_THUMB_WIDTH / width;
          width = MAX_THUMB_WIDTH;
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        console.log('[Tile.Thumb.Generated] Created thumbnail:', {
          originalSize: `${img.width}x${img.height}`,
          thumbSize: `${width}x${height}`
        });
        
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for thumbnail generation'));
    };
    
    img.src = imageUrl;
  });
}
