# Bug Tracking Guide

**Version:** 1.0  
**Date:** 29 August 2025  
**Purpose:** Internal documentation-based bug tracking system for the Tube Challenge app.

**Related Documents:**
- **[Known Issues](./known-issues.md)**: Current active issues registry
- **[Troubleshooting](./troubleshooting.md)**: Common problems and solutions
- **[Product Spec v0.2](./product-spec-v0.2.md)**: Current MVP features and acceptance criteria

---

## Overview

This guide defines our internal bug tracking process using markdown documentation instead of external tools. All bugs are tracked through documentation files, making the process lightweight and integrated with our development workflow.

---

## Bug Report Template

Use this template when reporting new bugs in `known-issues.md`:

```markdown
### BUG-XXX: [Brief Description]

**Severity:** [Critical/High/Medium/Low]  
**Status:** [New/In Progress/Testing/Resolved/Closed]  
**Component:** [Auth/Map/Check-in/Database/UI-UX/Performance/API]  
**Reported:** [YYYY-MM-DD]  
**Reporter:** [Name/Role]  
**Assigned:** [Developer Name]

**Description:**
Clear description of the issue and its impact.

**Steps to Reproduce:**
1. Step one
2. Step two
3. Expected vs actual behavior

**Environment:**
- Device/Browser: [e.g., iPhone 15 Safari, Chrome Desktop]
- App Version: [e.g., v0.2.0]
- User Type: [e.g., Authenticated user, New user]

**Related:**
- Product Spec Section: [Link to relevant spec section]
- Epic/Feature: [Reference to product backlog if applicable]
- Screenshots/Logs: [Attach or reference external files]

**Resolution:**
[To be filled when resolved - what was the fix, any code changes, testing performed]
```

---

## Severity Levels

### Critical
- **Impact:** App crashes, data loss, security vulnerabilities, authentication failures
- **Response Time:** Immediate (same day)
- **Examples:** Can't sign in, app crashes on startup, user data deleted

### High
- **Impact:** Core functionality broken, major user experience issues
- **Response Time:** 1-2 days
- **Examples:** Check-in fails, map won't load, route creation broken

### Medium
- **Impact:** Feature works but has usability issues, minor data inconsistencies
- **Response Time:** 3-5 days
- **Examples:** UI layout issues, slow performance, incorrect station names

### Low
- **Impact:** Cosmetic issues, nice-to-have improvements, edge case behaviors
- **Response Time:** Next sprint or backlog
- **Examples:** Button styling, minor text errors, enhancement requests

---

## Status Workflow

```
New → In Progress → Testing → Resolved → Closed
     ↓              ↓         ↓         ↓
  [Assigned]   [Development]  [QA]   [Verified]
```

### Status Definitions

- **New**: Bug reported and triaged, awaiting assignment
- **In Progress**: Developer actively working on the fix
- **Testing**: Fix implemented, ready for testing/review
- **Resolved**: Fix confirmed working, awaiting final closure
- **Closed**: Bug fully resolved and verified in production

---

## Component Categories

### Auth
Authentication, authorization, user sessions, profile management

### Map
Interactive map, station rendering, geolocation, map performance

### Check-in
Photo capture, AI verification, geofencing, station visit recording

### Database
Data persistence, Supabase integration, migration issues, RLS policies

### UI-UX
User interface, responsive design, accessibility, user experience flows

### Performance
Load times, memory usage, rendering performance, network efficiency

### API
Edge functions, external API integration, network requests, offline handling

---

## Bug ID System

- **Format**: `BUG-XXX` (e.g., BUG-001, BUG-002)
- **Numbering**: Sequential, starting from BUG-001
- **Uniqueness**: Each bug gets a unique ID that persists throughout its lifecycle
- **References**: Use bug ID in commit messages, PR descriptions, and documentation updates

---

## Documentation Workflow

### 1. Bug Discovery
- Anyone can report bugs by creating an entry in `known-issues.md`
- Use the bug report template above
- Assign a unique BUG-ID

### 2. Triage Process
- Review severity and component classification
- Assign to appropriate developer
- Add to current sprint or backlog based on severity

### 3. Development Process
- Update status to "In Progress"
- Reference BUG-ID in commits and PRs
- Document any implementation notes in the bug entry

### 4. Testing & Resolution
- Update status to "Testing" when ready for review
- Add resolution details including what was fixed
- Move to "Resolved" when fix is confirmed
- Close when deployed and verified in production

### 5. Documentation Updates
- Move resolved bugs to a "Recently Resolved" section
- Archive old closed bugs quarterly
- Update troubleshooting guide with common solutions

---

## Integration Points

### Product Spec Integration
- Link bugs to specific product spec sections when relevant
- Reference acceptance criteria that may need updates
- Note if bugs reveal gaps in current specifications

### Development Workflow
- Include BUG-ID in commit messages: `fix: resolve check-in geofence issue (BUG-012)`
- Reference bugs in PR descriptions
- Update bug status when PRs are merged

### User Communication
- Use friendly language in error messages and user-facing documentation
- Reference troubleshooting guide for common issues users can resolve themselves
- Maintain separation between internal bug tracking and user-facing help

---

## Maintenance & Review

### Weekly Review
- Review all "New" and "In Progress" bugs
- Update priorities based on user feedback
- Ensure status accuracy and assignment clarity

### Monthly Cleanup
- Archive resolved bugs older than 30 days
- Review component categories for trends
- Update troubleshooting guide with common patterns

### Quarterly Assessment
- Analyze bug patterns and root causes
- Review and update severity definitions
- Assess if process improvements are needed

---

## Example Bug Entry

```markdown
### BUG-001: Camera fails to open on iOS Safari

**Severity:** High  
**Status:** Resolved  
**Component:** Check-in  
**Reported:** 2025-08-28  
**Reporter:** QA Team  
**Assigned:** Development Team

**Description:**
Camera capture modal fails to open on iOS Safari when user attempts to take a photo for station check-in. Modal appears but camera permission is not requested, resulting in blank camera view.

**Steps to Reproduce:**
1. Open app on iOS Safari (tested iOS 17.5)
2. Start new activity check-in
3. Tap "Take Photo" button
4. Modal opens but camera doesn't activate
Expected: Camera opens with permission request
Actual: Blank camera view with no permission prompt

**Environment:**
- Device/Browser: iPhone 15 Safari 17.5, iPhone 14 Safari 17.4
- App Version: v0.2.0
- User Type: Authenticated user

**Related:**
- Product Spec Section: 4) Station Visits / Check-in
- Feature: Camera capture reliability on mobile
- Screenshots: [camera-fail-ios.png]

**Resolution:**
Added proper iOS Safari camera permission handling using navigator.mediaDevices.getUserMedia() with error handling. Implemented fallback to file input when camera access fails. Updated UI to show clear permission prompts and fallback options.
- Fixed in PR #45
- Tested on iOS 17.4-17.6
- Deployed to production 2025-08-29
```

---

## Getting Help

For questions about the bug tracking process:
1. Check the [Troubleshooting Guide](./troubleshooting.md) for common issues
2. Review existing bugs in [Known Issues](./known-issues.md) for similar problems
3. Reference the [Product Spec v0.2](./product-spec-v0.2.md) for current feature requirements
4. Consult the development team for technical implementation questions