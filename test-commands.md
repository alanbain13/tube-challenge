# Test Commands for A3.3 Geofence Implementation

## Unit Tests
```bash
# Run geofence configuration tests
npm test src/lib/__tests__/geofence.test.ts

# Run EXIF tests
npm test src/lib/__tests__/exif.test.ts

# Run integration tests
npm test src/lib/__tests__/geofence-integration.test.ts

# Run backend parity tests
npm test src/lib/__tests__/backend-geofence.test.ts

# Run checkin pipeline tests
npm test src/lib/__tests__/checkin-pipeline.test.ts

# Run UI/UX polish tests
npm test src/lib/__tests__/modal-dismissal-timing.test.ts
npm test src/lib/__tests__/toast-copy-snapshot.test.ts  
npm test src/lib/__tests__/cache-invalidation-e2e.test.ts
```

## Full Test Suite
```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run E2E tests
npx playwright test

# Run E2E tests in headed mode
npx playwright test --headed
```

## Manual Testing

### Radius Configuration
1. Test default 750m radius (no env var set)
2. Set `VITE_GEOFENCE_RADIUS_METERS=1000` and verify new radius is used
3. Test invalid values fall back to 750m

### Distance Persistence
1. Take photo near station (should show distance < 750m in database)
2. Take photo far from station (should show distance > 750m and pending status)
3. Check `geofence_distance_m`, `gps_source`, and `exif_gps_present` fields

### Backend Enforcement
1. Verify edge function `validate-geofence` is deployed
2. Test client-server distance calculation matching
3. Test detection of client tampering attempts

### Telemetry
1. Check console logs for geofence validation results
2. Verify structured logging includes GPS source and distance
3. Test pass/fail/skip scenarios are logged correctly