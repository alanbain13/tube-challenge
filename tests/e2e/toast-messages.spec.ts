import { test, expect } from '@playwright/test';

test.describe('Toast message standardization', () => {
  test('should show correct offline message', async ({ page }) => {
    await page.goto('/activities/test-activity-id');
    
    // Simulate offline state
    await page.context().setOffline(true);
    
    // Mock API failure due to offline
    await page.route('**/functions/v1/**', async route => {
      await route.abort('failed');
    });

    // Try to perform check-in
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg', 
      buffer: Buffer.from('fake-image-data')
    });

    await page.click('button:has-text("Check In")');
    
    // Verify offline message appears with correct copy
    await expect(page.locator('text="You\'re offline. Your check-in is saved as pending and will sync automatically."')).toBeVisible();
  });

  test('should show correct geofence failure message', async ({ page }) => {
    await page.goto('/activities/test-activity-id');
    
    // Mock successful OCR but failed geofence
    await page.route('**/functions/v1/verify-roundel', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_roundel: true,
          station_text_raw: 'TEST STATION',
          station_name: 'Test Station',
          confidence: 0.95
        })
      });
    });

    // Mock geolocation to be far from station
    await page.addInitScript(() => {
      const mockGeolocation = {
        getCurrentPosition: (success: any) => {
          success({
            coords: {
              latitude: 0, // Far from any London station
              longitude: 0,
            }
          });
        }
      };
      // @ts-ignore
      navigator.geolocation = mockGeolocation;
    });

    // Perform check-in
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data')
    });

    await page.click('button:has-text("Check In")');
    
    // Verify geofence failure message
    await expect(page.locator('text="We couldn\'t confirm you\'re near Test Station. Save as pending or retake a photo near the station."')).toBeVisible();
    
    // Verify action buttons are available
    await expect(page.locator('button:has-text("Save as Pending")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('should show correct duplicate check-in message', async ({ page }) => {
    await page.goto('/activities/test-activity-id');
    
    // Mock successful OCR and geofence but duplicate error
    await page.route('**/functions/v1/verify-roundel', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_roundel: true,
          station_text_raw: 'TEST STATION',
          station_name: 'Test Station', 
          confidence: 0.95
        })
      });
    });

    await page.route('**/functions/v1/record-visit', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'duplicate_visit',
            message: 'Already checked in to Test Station for this activity.',
            station_id: 'test-station'
          }
        })
      });
    });

    // Perform check-in
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data')
    });

    await page.click('button:has-text("Check In")');
    
    // Verify duplicate message uses correct copy
    await expect(page.locator('text="Already checked in"')).toBeVisible();
    await expect(page.locator('text="Already checked in to Test Station for this activity."')).toBeVisible();
    
    // Should not use "at" - should use "to"
    await expect(page.locator('text="Already checked in at Test Station"')).not.toBeVisible();
  });
});