# Known Issues Registry

**Last Updated:** 29 August 2025  
**Purpose:** Active tracking of current bugs and issues in the Tube Challenge app.

**Related Documents:**
- **[Bug Tracking Guide](./bug-tracking-guide.md)**: Process and templates for reporting bugs
- **[Troubleshooting](./troubleshooting.md)**: User-facing solutions for common problems
- **[Product Spec v0.2](./product-spec-v0.2.md)**: Current MVP features and acceptance criteria

---

## Active Issues

*No active issues currently tracked. This section will be populated as bugs are discovered and reported.*

---

## In Progress

*Issues currently being worked on by the development team will appear here.*

---

## Recently Resolved

*Recently fixed issues will be listed here for reference before being archived.*

---

## How to Report a Bug

1. **Check this document** to see if the issue is already known
2. **Check [Troubleshooting Guide](./troubleshooting.md)** for possible solutions
3. **Create a new bug entry** using the template in [Bug Tracking Guide](./bug-tracking-guide.md)
4. **Follow the severity guidelines** to classify the issue appropriately

---

## Bug Report Template (Quick Reference)

```markdown
### BUG-XXX: [Brief Description]

**Severity:** [Critical/High/Medium/Low]  
**Status:** New  
**Component:** [Auth/Map/Check-in/Database/UI-UX/Performance/API]  
**Reported:** [YYYY-MM-DD]  
**Reporter:** [Name/Role]  
**Assigned:** [To be assigned]

**Description:**
[Clear description of the issue and its impact]

**Steps to Reproduce:**
1. [Step one]
2. [Step two]
3. [Expected vs actual behavior]

**Environment:**
- Device/Browser: [e.g., iPhone 15 Safari, Chrome Desktop]
- App Version: [e.g., v0.2.0]
- User Type: [e.g., Authenticated user, New user]

**Related:**
- Product Spec Section: [Link to relevant spec section]
- Epic/Feature: [Reference to product backlog if applicable]
```

---

## Component Categories

- **Auth**: Authentication, authorization, user sessions, profile management
- **Map**: Interactive map, station rendering, geolocation, map performance  
- **Check-in**: Photo capture, AI verification, geofencing, station visit recording
- **Database**: Data persistence, Supabase integration, migration issues, RLS policies
- **UI-UX**: User interface, responsive design, accessibility, user experience flows
- **Performance**: Load times, memory usage, rendering performance, network efficiency
- **API**: Edge functions, external API integration, network requests, offline handling

---

## Severity Guidelines

- **Critical**: App crashes, data loss, security vulnerabilities, authentication failures
- **High**: Core functionality broken, major user experience issues
- **Medium**: Feature works but has usability issues, minor data inconsistencies  
- **Low**: Cosmetic issues, nice-to-have improvements, edge case behaviors

---

## Archive Policy

- **Resolved bugs** are moved to "Recently Resolved" section for 30 days
- **Closed bugs** older than 30 days are archived quarterly
- **Historical bugs** are maintained for pattern analysis and regression prevention

---

*This registry will be updated as issues are discovered, resolved, and closed. Check the [Bug Tracking Guide](./bug-tracking-guide.md) for the complete process.*