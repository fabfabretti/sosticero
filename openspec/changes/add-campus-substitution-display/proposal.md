# Proposal

## Why

Staff-room monitors need a readable, unattended view of today's substitutions for their campus. The operational interface requires login and includes controls and private information unsuitable for this display.

## What Changes

- Add direct public links `/display?campus=centrale` and `/display?campus=succursale`, without adding a top-bar button.
- Show only teachers assigned at least one substitution at the selected campus today; hours 1–7 contain class, room and the displayed names of the teachers being replaced, with ordinary lessons blank.
- Fit a 16:9 viewport using one table, then two tables when needed; rotate overflow pages every 15 seconds only when necessary.
- Show campus-specific late-entry and early-exit class notes below the grid, without teacher-count/refresh text or a fullscreen button.
- Refresh every 30 seconds, roll over at Europe/Rome midnight, and visibly report failed updates.
- Add an explicitly public, read-only, minimal projection; retain authentication for all existing operational APIs.

## Capabilities

### New Capabilities

- `substitution-display`: Campus-specific public daily substitution board, layout, refresh and overflow behavior.

### Modified Capabilities

- `app-shell`: Exempt the standalone display from navigation and Inbox UI; preserve existing operational routes.
- `user-auth`: Permit only the new minimal display API without authentication while retaining existing protections.

## Impact

Backend daily row and assignment projection, authentication middleware allowlist, frontend route selection before Auth, display component and styles, SPA serving/deep links, focused tests and deployment documentation. No new dependencies or database schema changes are expected. Existing assignment editing, permissions and stored data remain unchanged. Out of scope: full weekly timetables, editing, public absence reasons, publication/approval workflows, and deployment during planning.
