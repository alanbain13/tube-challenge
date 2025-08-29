# Tube Challenge – Product Spec and User Stories v0.1

Version: 0.1
Last updated: 2025-08-11
Owner: Product + Engineering

Purpose:
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

Key Features
- Tube Network Integration
  - Real-time API integration (e.g., TfL for London) to track routes and station data.
  - Offline map for navigation without connectivity.
- Station Check-In
  - GPS or NFC-based station check-in.
  - Optionally scan signage or tap into WiFi/Cell ID.
- Challenges & Modes
  - Zone 1 Sprint: Visit all Zone 1 stations fastest.
  - Alphabet Run: Visit stations starting with each letter.
  - Line Mastery: Ride every station on a given line.
  - Time Trial: Beat your own or others’ best times.
  - Treasure Hunt: Solve clues to find and visit specific stations.
- Route Optimiser
  - Smart route planning using timetable and walking options.
  - Suggest detours for extra achievements or hidden gems.
- Leaderboards & Stats
  - Global and friends-only rankings.
  - Your best times, longest routes, most lines ridden.
- Social & Sharing
  - Share completed challenges on socials.
  - Track friends live (opt-in) or compare runs.
- Rewards System
  - Virtual medals, badges, and trophies.
  - Unlock facts about stations or hidden content.

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

## Master Feature List and User Stories

1. User Onboarding
- 1.1 As a new user, I want to create an account using email or Google/Apple login so that I can securely track my progress.
- 1.2 As a user, I want to set up my profile with an avatar, name, and home station so that my experience feels personalised.
- 1.3 As a first-time user, I want to view a short tutorial so that I understand how to use the app.

2. Interactive Tube Map
- 2.1 As a user, I want to view a tappable map of the London Underground so I can explore stations and lines.
- 2.2 As a user, I want the map to show which stations I’ve visited so I can track progress visually.
- 2.3 As a user, I want to see service alerts on the map so I can plan around delays.

3. Station Check-In System
- 3.1 As a user, I want to check in at a station using GPS so I can track which stations I've visited.
- 3.2 As a user, I want the app to prevent duplicate check-ins so my stats are accurate.
- 3.3 As a user, I want to manually check in when GPS fails so I can continue the challenge.

4. Game Modes / Challenges
- 4.1 As a user, I want to participate in a Zone 1 Sprint challenge so I can complete all Zone 1 stations as fast as possible.
- 4.2 As a user, I want to complete an Alphabet Run challenge so I can visit stations starting with every letter.
- 4.3 As a user, I want to complete Line Mastery challenges so I can say I’ve ridden full lines.
- 4.4 As a user, I want to repeat time trials to beat my own score and improve.
- 4.5 As a user, I want to create custom challenges to suit my own goals.

5. Smart Route Planner
- 5.1 As a user, I want the app to suggest the optimal route to complete a challenge so I can finish it efficiently.
- 5.2 As a user, I want to choose between fastest, most efficient, or scenic options to suit my preferences.

6. Achievements & Badges
- 6.1 As a user, I want to earn badges when I complete milestones so that I feel rewarded.
- 6.2 As a user, I want to see hidden achievements to keep gameplay interesting and surprising.
- 6.3 As a user, I want to browse a badge gallery to see what I’ve earned and what’s next.

7. User Profile & Stats
- 7.1 As a user, I want to view stats like total stations visited, lines completed, and distance traveled so I can track my progress.
- 7.2 As a user, I want to share my stats to social media so I can show off my achievements.

8. Live Leaderboards
- 8.1 As a user, I want to see global leaderboards by challenge to compare my score with others.
- 8.2 As a user, I want to view leaderboards filtered by friends, city, or time period to get more relevant comparisons.
- 8.3 As a user, I want to tap on a name in the leaderboard to view that player’s profile (if public).

9. Social Integration
- 9.1 As a user, I want to follow friends so I can compare our progress.
- 9.2 As a user, I want to see friends’ recent activity, badges, and challenge completions.
- 9.3 As a user, I want to share screenshots or challenge outcomes to social media.
- 9.4 As a user, I want to race against a friend’s previous run in ghost mode.

10. Notifications & Alerts
- 10.1 As a user, I want to receive alerts when I’m near a new station so I don’t miss a check-in.
- 10.2 As a user, I want to receive reminders for ongoing or new challenges.
- 10.3 As a user, I want to be notified if a disruption affects my planned route.

11. Offline Mode
- 11.1 As a user, I want to check in even when offline so I don’t lose progress.
- 11.2 As a user, I want my check-ins to sync automatically when I regain connection.

12. Content & Trivia
- 12.1 As a user, I want to unlock trivia or history facts at stations to make the experience more educational and fun.
- 12.2 As a user, I want to collect interesting facts about places I’ve visited as a souvenir of my trips.

13. Settings & Preferences
- 13.1 As a user, I want to control notification settings so I only get alerts I care about.
- 13.2 As a user, I want to manage my privacy settings including profile visibility and location sharing.
- 13.3 As a user, I want to export my journey data for personal use.

14. Admin & Game Master Tools
- 14.1 As an admin, I want to create timed global or local challenges for users to participate in.
- 14.2 As an admin, I want to moderate the leaderboard for fairness.
- 14.3 As an event organiser, I want to set hidden codes or check-ins for scavenger hunts.

15. Monetisation
- 15.1 As a user, I want to purchase extra badge packs or features to customise my experience.
- 15.2 As a premium user, I want advanced stats and unlimited challenge creation.
- 15.3 As a user, I want to use the app for free with optional ads.
- 15.4 As a business partner, I want to sponsor routes or events to reach the app’s audience.

