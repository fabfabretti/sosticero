# Tasks

## 1. Server-derived campus notices

- [x] 1.1 Derive qualifying D assignments and grouped notice content using effective manual/automatic availability campus; verify backend cases for known different campuses, same/unknown campuses, manual overrides, automatic availability and varying origins.
- [x] 1.2 Add optional assignment notice metadata and reconciliation across assignment, availability, class-out, absence and timetable saves; verify both statuses reset on membership/content changes, survive no-op saves and unrelated changes, and never resurrect after group removal/recreation.
- [x] 1.3 Extend backup validation and serialization for notice metadata; verify old archives load without metadata, malformed metadata is rejected, and a backup round trip retains valid statuses without changing RP/paid/special records.

## 2. Atomic communication mutations

- [x] 2.1 Expose grouped content/status in daily data and implement independent group-wide status toggles with destination-campus authorization; verify persistence and unauthorized API rejection using isolated database tests.
- [x] 2.2 Add group content/status concurrency preconditions and atomic member updates; verify stale requests after member additions, edits, removals and concurrent status changes fail without partial updates.
- [x] 2.3 Document the new notice fields and grouped mutation semantics beside the existing API/state documentation; verify documented payloads match backend tests.

## 3. Daily UI and copied message

- [x] 3.1 Add typed notice data and Comunicato/Accettata/Copy controls on qualifying substitution rows, reusing existing UI conventions; verify grouped row synchronization, reload persistence, campus permissions and unchanged RP/paid/entry-exit controls with frontend tests.
- [x] 3.2 Implement the specified Italian message with sorted hours and substitutions, missing-room fallback, account-name signature and the exact reminder; verify copied text and clipboard success/failure feedback, including that copying never changes status.

## 4. Integration and deployment

- [x] 4.1 Run relevant backend/frontend suites and production build; rebuild only a uniquely named isolated compose.testing.yaml project with a fresh temporary TEST_DATA_DIR using the prescribed LOCAL_UID/LOCAL_GID command, inspect its mount/allocated port and confirm /api/environment testing=true plus the red TESTING ribbon before behavioral changes; verify a complete multi-hour communication/invalidation flow and stop only that project afterward.
- [x] 4.2 Deploy the verified feature using ./scripts/deploy.sh and verify the deployed release and production mount through read-only checks; record outcomes without modifying production operational records.

## 5. Follow-up fixes and personalization

- [x] 5.1 Guard campus notice rendering during date transitions; verify the regression reproduces the original TypeError, passes with the guard, and the next date loads in an isolated browser scenario, then deploy and verify read-only release checks.
- [x] 5.2 Personalize all three message greetings and signatures; verify template text, daily control props, all 275 frontend tests and isolated build, then deploy and verify the production release and mount.

## Workflow follow-up

- Ask the user whether to commit before creating a commit.
- Archive the change only when requested after implementation and verification.
