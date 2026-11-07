# Proposal

## Why

Teachers need safe personal access to their timetable without receiving office permissions or seeing colleagues' data. Establishing individually administered email/PIN access provides the foundation for a teacher portal without requiring email delivery or Google Workspace integration.

## What Changes

- Extend the existing Amministrazione → Gestione docenti → Docenti view with inline login-email entry, enabled status, and generate/reset PIN actions; retain teacher creation and prolonged-absence/replacement workflows.
- Support keyboard entry across rows, search, a missing-email filter and one save for edited email/access rows.
- Add personal eight-digit PIN authentication, explicit stable-person linkage, revocable sessions, temporary attempt limits and administrator-mediated recovery.
- Add a dedicated mobile-friendly Portale docenti showing only the signed-in teacher's effective timetable, initially today with date navigation, using existing visual conventions.
- Keep credentials in the identity store and operational records unchanged. Leave future Google identity linking possible without implementing it.
- Exclude daily supplenze, publication changes, receipt/signature handling, recupero requests/outcomes, notifications, email delivery and Google login from this release.

## Capabilities

### New Capabilities

- `teacher-portal`: Administration of teacher access, personal email/PIN authentication, restricted teacher sessions and effective personal timetable browsing.

### Modified Capabilities

None. Existing `user-auth` governs office accounts; teacher principals add an independent restricted access path without granting or changing office permissions. Pending account-administration and permanent-replacement changes remain prerequisites rather than being rewritten here.

## Impact

- Backend identity schema/services and authentication middleware in `backend/auth.py`, narrowly scoped administration and teacher endpoints in `backend/main.py`, and existing effective timetable/person resolution.
- Frontend `Staffing.tsx`, routing/authentication bootstrap, session handling and shared UI styles; new teacher portal components.
- Identity migration, security and timetable regression tests, administrator documentation and deployment compatibility. No external identity, mail service or additional database service required.
