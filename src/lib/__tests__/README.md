# EXIF Processing Tests

This directory contains tests for EXIF data extraction and check-in pipeline integration.

## Running Tests

```bash
# Run all tests
npx vitest

# Run tests in watch mode
npx vitest --watch

# Run specific test file
npx vitest exif.test.ts

# Run integration tests
npx vitest checkin-pipeline.test.ts
```

## Test Coverage

### Unit Tests (`exif.test.ts`)
- Tests `extractImageGPS()` function with various EXIF scenarios
- Tests `extractImageTimestamp()` function with timestamp extraction
- Validates error handling and fallback behavior

### Integration Tests (`checkin-pipeline.test.ts`)
- Tests the complete check-in pipeline with EXIF data processing
- Validates mutation payload construction with proper fallback values
- Tests `captured_at`, `exif_time_present`, and `exif_gps_present` field population
- Ensures proper handling of missing EXIF data scenarios

## Test Fixtures

The tests currently use minimal JPEG fixtures. In a production environment, you would:

1. Create actual test images with embedded EXIF GPS and timestamp data
2. Use tools like `exiftool` to embed test GPS coordinates and timestamps
3. Test with various image formats and EXIF configurations

## Implementation Notes

- EXIF functions are now async and use the `exifr` library
- GPS coordinates fallback to device location when EXIF GPS is unavailable
- Timestamps fallback to `visited_at` when EXIF timestamp is unavailable
- All EXIF extraction errors are handled gracefully with appropriate fallbacks