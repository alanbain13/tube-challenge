# Tube Challenge – Product Spec and User Stories

Version: 0.1
Last updated: 2025-08-11
Owner: Product + Engineering

Purpose
- Single source of truth to guide planning, implementation, and QA
- Easy to update via PRs; reference in issues and commits

How to use
- Update this document whenever scope changes
- Each feature has: context, user stories, acceptance criteria, and open questions
- Link related PRs/issues beneath each feature

Glossary
- TfL ID: Transport for London station identifier used in source GeoJSON
- Station UUID: Internal unique ID when needed in DB
- Station visit: A record indicating a user has visited a station

Personas
- Player: Authenticated user completing Tube challenges
- Admin/Maintainer: Manages data sources and monitors system health

1) Authentication
Context: Users must authenticate to access the app. Unauthed users go to /auth.

User Stories
- As a new user, I can sign up/sign in so I can access the app
- As a returning user, I stay signed in unless I sign out

Acceptance Criteria
- Unauthenticated users navigating to protected routes are redirected to /auth
- Successful sign-in redirects to /
- Sign out button signs user out and returns them to /auth
- Errors are displayed with a non-blocking toast

Open Questions
- Additional providers (OAuth)?

2) Profile Setup
Context: After authentication, users without a display_name are prompted to complete basic profile.

User Stories
- As an authenticated user without a profile name, I am prompted to set my display name so others can identify me

Acceptance Criteria
- If profile.display_name is missing, render ProfileSetup
- Validation: display_name required, length 2–30
- On save, profile persists and user proceeds to dashboard

Open Questions
- Additional profile fields (avatar, bio) in scope?

3) Interactive Map
Context: Map renders stations and lines from public/data/stations.json (GeoJSON). Supports selection and visualization.

User Stories
- As a user, I can see a map of London Underground stations and lines
- As a user, I can tap/click a station to view details

Acceptance Criteria
- Load GeoJSON from public/data/stations.json
- Render Point features as stations, LineString as lines
- Stations and lines are styled distinctly; selection highlights a station
- Works on mobile and desktop (pan/zoom performant)

Open Questions
- Additional filters (by line/zone)?
- Clustering at lower zoom levels?

4) Station Visits (Progress Tracking)
Context: Users can mark stations as visited; data stored by station_tfl_id per recent migration.

User Stories
- As a user, I can mark/unmark a station as visited so I can track progress
- As a user, I can see which stations I’ve visited on the map

Acceptance Criteria
- Toggle visit on station uses station_tfl_id
- Visual state indicates visited vs not visited
- Persisted to Supabase table (station_visits) for the signed-in user
- Optimistic UI with toast feedback on success/failure

Open Questions
- Bulk import/export of visits?
- Date/time of visit required or optional?

5) Zone 1 Sprint (Upcoming)
Context: Future time-based challenge focused on Zone 1 stations.

User Stories
- As a user, I can participate in a timed Zone 1 sprint challenge

Acceptance Criteria (MVP placeholder)
- Feature tile appears as “Coming Soon” and is disabled

Open Questions
- Ruleset and timing mechanics
- Leaderboards, anti-cheat considerations

6) Data Management / Admin
Context: Maintain station dataset and mapping between TfL IDs and internal IDs.

User Stories
- As an admin, I can upload or refresh the stations dataset from a trusted source
- As an admin, I can manage mappings between TfL IDs and internal UUIDs

Acceptance Criteria
- Stations GeoJSON is the source-of-truth file in public/data/stations.json
- Mapping table station_id_mapping exists (per migration) and is used by services when needed
- Upload functions are secured; non-admins cannot invoke

Open Questions
- Admin UI scope and role management

Non-Functional Requirements
- Performance: map interactions remain smooth on mid-range mobile devices
- Accessibility: keyboard operability and sufficient contrast
- SEO: public pages include proper titles, descriptions, and a single H1
- Security: RLS policies protect user-specific data; no unauthenticated access to private endpoints
- Observability: basic logging for data upload functions

Roadmap (Proposed)
- 0.1: Auth, Profile Setup, Interactive Map read-only
- 0.2: Station visit tracking + persisted progress
- 0.3: Filters, search, and simple stats
- 0.4: Zone 1 Sprint MVP
- 0.5: Admin data management UI

Changelog
- 0.1 (2025-08-11): Initial spec created from current codebase and migration plan

Linking
- Related files: src/pages/Index.tsx, src/pages/Auth.tsx, src/pages/Map.tsx, src/components/Map.tsx, public/data/stations.json
- Database: Supabase migration adding station_id_mapping and station_tfl_id usage in station_visits

Contributing
- Propose changes via PRs; keep stories testable with Gherkin-style acceptance criteria when possible
- Example template:

Feature: <name>
- Context: <why/what>
- Stories:
  - As a <role>, I can <action> so that <benefit>
- Acceptance Criteria:
  - Given <preconditions>, When <action>, Then <expected>
- Open Questions:
  - <list>
