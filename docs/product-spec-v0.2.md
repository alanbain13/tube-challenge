# Tube Challenge App - Product Spec v0.2

**Version:** 0.2  
**Date:** 29 August 2025  
**Status:** MVP Implementation Guide  
**Previous Version:** [Product Spec v0.1](./product-spec.md)  
**Future Vision:** [Product Vision Backlog](./product-vision-backlog.md)

---

## Purpose
This document focuses specifically on MVP features and implementation details. It updates acceptance criteria, adds missing behaviors, and clarifies data/state management for the current development cycle.

---

## 0) Shared Domain & State

### Entities
* **activity**: `{ id, user_id, title, mode: "planned" | "unplanned", created_at, started_at, finished_at }`
* **route**: `{ id, title, station_sequence: [station_tfl_id…] }`
* **activity_plan_item**: `{ activity_id, station_tfl_id, seq_planned }` // optional for unplanned
* **station_visit**: `{ id, activity_id, user_id, station_tfl_id, seq_actual, status: "verified"|"pending"|"rejected", captured_at, image_url, thumb_url, lat, lng, created_at }`

### Unique Constraints
* `(activity_id, station_tfl_id)` unique ⟵ prevents duplicates within the activity
* `(user_id, station_tfl_id, DATE_TRUNC('day', captured_at))` optional, if you also want 1/day/user dedupe.

### Derived State
* **visited_set(activity_id)**: all station_visit.status in ('verified','pending')
* **planned_set(activity_id)**: all activity_plan_item
* **remaining** = planned - visited
* **seq_actual** is assigned in arrival order (1…n) for an activity.

---

## 3) Interactive Map (updated)

### User Stories (unchanged)
[Reference v0.1 for base user stories]

### Acceptance Criteria (add)
* **For planned activities**: map displays
  * Blue markers for planned stations (remaining)
  * Red markers for visited (ordered by seq_actual)
  * **Path**:
    * Solid red polyline along visited sequence (1→n)
    * Dotted red polyline preview from last visited to remaining planned in seq_planned order
* **For unplanned activities**: map displays visited markers (red) and solid red polyline (1→n).
* Activity map renders on mobile without layout overflow; no flicker when navigating from dashboard.

---

## 4) Station Visits / Check-in (updated & clarified)

### User Stories (add)
* As a user, I can check in by photo first (image upload or camera) with order-agnostic validation.

### Acceptance Criteria (replace/expand)
* **Flow**: Upload/take photo → detect roundel → OCR station name → resolve station → geofence check:
  * If EXIF GPS present → use EXIF coords
  * Else if device GPS available → use device coords
  * Else → skip geofence and mark pending (never auto-verified)
* **Geofence tolerance**: default 750m (configurable; large stations are forgiving)
* **Timestamps**: captured_at uses EXIF DateTimeOriginal; if missing, fall back to device time.
* **Duplicates**:
  * If same (activity_id, station_tfl_id) already visited → show friendly "Already checked in to Pimlico for this activity" and do not create a new record.
* **Statuses**:
  * **verified** when roundel+OCR passes and geofence passes
  * **pending** when AI disabled, offline, EXIF missing and device denied, or geofence fails (but user confirms keep as pending)
* **UX**:
  * After success (pending or verified), show summary with Close button; returning to Activity should reflect updated visited list and map immediately.
  * HUD hides automatically after first check-in; can be reopened via a small "i" affordance.
  * Camera capture opens reliably on mobile (use input capture="environment" & Permissions API; provide "Use Photo Library" fallback).
* **Performance**: Modal dismiss < 300ms; image upload + optimistic UI; thumbnails appear in the visit list.

---

## 5) Challenges & Modes (rename "Start Activity" behavior)

### Acceptance Criteria (add)
* **Only two start modes**:
  * **Unplanned**: creates activity with no activity_plan_item; first successful check-in auto-starts.
  * **Planned**: selecting a saved route clones entire route.station_sequence into activity_plan_item with seq_planned preserved. Start/end stations visible and the full sequence is present.
* **"Unplanned activity warning"** widget is removed (not needed).

---

## 5.5) Route Planner (updated)

### Acceptance Criteria (add)
* Creating/editing a route persists station_sequence (ordered). Start/end are derived from the sequence.
* When viewing/editing later, the ordered list and map selection reflect the saved sequence.
* Cloning a route to an activity copies the full sequence (no truncation).

---

## 8) Live Leaderboards (no change now)
[Reference v0.1 for current specifications]

---

## 11) Offline Mode (new MVP)

### Stories
* As a user, I can check in when offline; my photo, EXIF, and chosen station are cached and sync later.

### Acceptance Criteria
* **When offline**:
  * Save a local queue item: `{ image (Blob), derived OCR text, resolved station candidate(s), EXIF time/coords, user notes, attempted activity_id }`.
  * Create an optimistic pending station_visit locally; UI shows "Pending sync".
* **When online**:
  * Background sync posts queued visits; pending → verified if geofence check later passes; otherwise remains pending.
* Edge-function/network errors surface friendly offline wording and retry guidance.

---

## 12) Content & Media (updated)

### Acceptance Criteria (add)
* Each station_visit stores image_url + thumb_url.
* Activity details page shows a thumbnail strip (tap to view full image); thumbnails load lazily.
* Thumbnails appear in station rows as small chips.

---

## Non-Functional (expanded)

* **Responsiveness**: Buttons and HUD adapt to narrow screens; no horizontal overflow on iPhone Safari/Chrome.
* **Performance**: Navigations < 500ms perceived; image thumbnails lazy-loaded; map style loads without blocking UI.
* **Telemetry**: Log key steps (Checkin.Step1_OCR, Step2_Resolve, Step3_Geofence, Persist.Success/Fail, Map.Render) with activity_id and station_tfl_id.

---

## Error & Empty States (new)

* **Offline**: "You're offline. Your check-in is saved as pending and will sync automatically."
* **Geofence fail**: "We couldn't confirm you're near Pimlico. Save as pending or retake a photo near the station."
* **Duplicate check-in**: "Already checked in to Pimlico for this activity."
* **Map empty (unplanned)**: Show visited legend & hint "Check in to your first station to draw your route."

---

## Related Documentation

* **[Product Spec v0.1](./product-spec.md)**: Original comprehensive vision and user stories
* **[Product Vision Backlog](./product-vision-backlog.md)**: Long-term epics and features beyond MVP
* **[AI Verification Setup](./ai-verification-setup.md)**: Configuration for roundel detection and station validation
* **[Bug Tracking Guide](./bug-tracking-guide.md)**: Issue reporting and resolution process

---

## Changelog

* **v0.2** (2025-08-29): MVP-focused spec with entity definitions, updated acceptance criteria, and implementation details
* **v0.1** (2025-08-11): [Original comprehensive spec](./product-spec.md) with broad vision and user stories