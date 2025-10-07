# Lovable Prompts – A3 Check-in Pipeline Remediation

These prompts are scoped to close the remaining A3 gaps. Each brief calls out the current-code references Lovable should modify plus explicit acceptance criteria. Share them individually so work can be delivered incrementally.

## Prompt 1 – Supabase schema & generated types
**Objective:** Extend `public.station_visits` with the A3 metadata needed for EXIF timestamps, GPS provenance, thumbnails, and status auditing.

**Context:** `supabase/migrations/20250924035111_485beb1b-6184-43bc-aa46-2afb007cae52.sql` already adds some columns, but the Lovable UI has not run this migration or regenerated types. The React code still imports `StationVisitInsert` without the new fields.

**Deliverables:**
- Apply/verify the migration in Supabase so the columns exist (`captured_at`, `thumb_url`, `seq_actual`, `gps_source`, `geofence_distance_m`, `exif_time_present`, `exif_gps_present`, `pending_reason`, `verifier_version`).
- Regenerate Supabase client types so `StationVisitInsert` and RPC payload types include the new fields.
- Document the column fallback logic in `docs/ai-verification-setup.md` so QA can confirm behaviour.

**Acceptance tests:** Reset the DB locally and confirm `information_schema.columns` returns the new fields; type-check a `StationVisitInsert` with the extra metadata.

## Prompt 2 – EXIF ingestion (GPS + timestamp)
**Objective:** Replace the stubbed EXIF helpers with real parsing so photos supply both coordinates and capture time.

**Context:** `src/lib/exif.ts` exports `extractImageGPS` and `extractImageTimestamp`, but `extractImageGPS` always resolves `null` and `extractImageTimestamp` is unused. `ActivityCheckin.tsx` falls back to device GPS/time immediately, so `captured_at` and `exif_*` flags are never set.

**Deliverables:**
- Implement EXIF parsing (e.g., `exifr`) to populate latitude/longitude and `DateTimeOriginal` (fallback `CreateDate` → `ModifyDate`).
- Update `runValidationPipeline` in `src/pages/ActivityCheckin.tsx` to await both helpers via `Promise.all`, set `captured_at`, `exif_time_present`, and `exif_gps_present` in component state, and surface parsing failures as warnings not crashes.
- Ensure the pipeline prefers EXIF GPS over device GPS and records which source was used.

**Acceptance tests:** Vitest coverage using fixture JPEGs with/without EXIF; manual check-in that stores `captured_at` equal to the EXIF timestamp and flags `exif_time_present=true`.

## Prompt 3 – Geofence configuration & persistence
**Objective:** Centralise the 750 m geofence radius and persist the computed distance/source for every visit.

**Context:** `ActivityCheckin.tsx` still does `parseInt(import.meta.env.VITE_GEOFENCE_RADIUS_METERS || '500')`, ignores the 750 m requirement, and never saves the distance or GPS provenance. There is no backend enforcement to keep the client honest.

**Deliverables:**
- Introduce a shared config helper (e.g., `src/config/geofence.ts`) that resolves `GEOFENCE_RADIUS_METERS` with a default of 750 and use it everywhere (client + backend).
- Compute `geofence_distance_m` whenever GPS is available, set `gps_source` to `'exif'`, `'device'`, or `'none'`, and persist those fields in the mutation payload.
- Mirror the distance check inside the Supabase RPC/edge function so pass/fail cannot be bypassed by a tampered client.
- Emit structured telemetry/logging for pass/fail/skip results if telemetry is enabled.

**Acceptance tests:** Unit test for radius resolution; integration test verifying a visit inside/outside radius stores distance and source correctly and respects the configured threshold.

## Prompt 4 – Status matrix, sequence numbering, and duplicate guard
**Objective:** Move persistence into a dedicated Supabase RPC that owns sequence assignment, status decisions, and duplicate protection before insert.

**Context:** The client still inserts directly into `station_visits`, hard-codes `status: 'verified'`, sets `visited_at` with device time, and relies on the DB unique index to throw duplicates after optimistic UI updates.

**Deliverables:**
- Create an RPC/edge function (e.g., `rpc.record_visit`) that: (1) looks up the max `seq_actual` for the activity and increments it atomically, (2) derives `status`/`pending_reason` from OCR/geofence/flag inputs, (3) enforces one row per `(activity_id, station_tfl_id)` and returns a structured duplicate error before insert, and (4) writes all metadata fields listed in Implementation Rule 4.
- Update the client mutation to call this endpoint, pass the EXIF/geofence metadata, and handle the duplicate response by showing “Already checked in to {station} for this activity.”
- Record `verifier_version` alongside resolver metadata (`ocr_text`, `resolver_rule`, `resolver_score`).

**Acceptance tests:** API test that races two inserts for the same station and confirms the second returns the friendly duplicate payload with no new row; unit tests covering each status branch (`verified` vs `pending` reasons).

## Prompt 5 – UI/UX polish & instant refresh
**Objective:** Align the UI with A3 rules: faster success dismissal, consistent messaging, thumbnails, and immediate query refresh.

**Context:** `handleSubmit` keeps the modal open for 1000 ms, duplicate copy differs from the spec, offline and geofence failure messaging is inconsistent, and pending flows send base64 blobs instead of stored URLs.

**Deliverables:**
- Shorten the success timeout to <300 ms (ideally use a promise chain instead of `setTimeout`) and ensure `useQueryClient().invalidateQueries` fires immediately for activity detail, counters, and map queries.
- Standardise toast text for offline/geofence/duplicate states using the copy from Implementation Rule 6.
- Ensure all photo uploads write to storage first and persist both `image_url` and `thumb_url`, displaying a placeholder thumbnail until upload completes.
- Remove any HUD overlays or navigation changes introduced during testing.

**Acceptance tests:** Playwright flow asserting modal closes within 300 ms and the activity map updates without reload; snapshot tests for toast copy.

## Prompt 6 – Simulation & feature-flag compliance
**Objective:** Honour `simulationModeEffective` and `AI_VERIFICATION_ENABLED` throughout the pipeline while keeping metadata intact.

**Context:** The flags exist but are not respected—the client ignores `AI_VERIFICATION_ENABLED`, and simulation currently only bypasses geofence math without persisting why the decision was made.

**Deliverables:**
- Ensure the client surfaces both flags to the new RPC and that the RPC enforces: simulation may mark geofence skips as verified, while `AI_VERIFICATION_ENABLED=false` forces pending with `pending_reason='ai_disabled'`.
- Persist `gps_source='none'` and omit distance when simulation deliberately skips GPS, but continue saving EXIF timestamps/metadata.
- Add telemetry hooks (optional) so logs show when flags override normal behaviour.

**Acceptance tests:** Unit test toggling each flag to confirm status outcomes; manual QA script verifying pending rows include the right `pending_reason` and that simulation still records resolver metadata.

