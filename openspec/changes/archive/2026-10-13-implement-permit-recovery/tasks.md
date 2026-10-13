# Tasks

## 1. Permit identity and accounting

- [x] 1.1 Add persistent permit-ID metadata and idempotent transactional migration; verify legacy fixtures retain periods, request dates, manual absences and unchanged assignments after repeated startup.
- [x] 1.2 Implement calendar-month deadlines, indexed linked usage, oldest-eligible selection and summaries; verify month ends, leap years, inclusive deadlines, expired debt, retrospective dates, future reservations and fixed attribution after backdated permits.
- [x] 1.3 Protect permit mutations and preserve identities during valid edits; verify deletion, teacher changes, capacity reductions and invalid date moves fail atomically, while valid edits retain links and refresh derived absences.

## 2. Candidate computation and assignment lifecycle

- [x] 2.1 Add RP eligibility after normal category precedence; verify free periods qualify, normal categories consume no recovery, and scheduled/hidden activities, absences, retired teachers and double booking cannot be bypassed.
- [x] 2.2 Implement convenience and two-sided travel checks with candidate ranking; verify same-campus 2/3/5 gives 1/4/6, long gaps, no-teaching days, unknown campuses, both break boundaries, and the blocked cross-campus period-4 gap example.
- [x] 2.3 Save server-selected permit links and release replaced assignments in the existing transaction; verify unchanged saves are idempotent, cancellation/replacement restores capacity, failed replacements preserve old state and competing final-hour requests allow only one consumer.
- [x] 2.4 Integrate saved-RP validation with daily issues and statistics; verify a final-hour RP remains valid on reload, RP appears in category statistics, review flags do not refund hours and timetable replacement preserves historical links and accounting.

## 3. Archive compatibility

- [x] 3.1 Version recovery-aware exports and accept legacy schema-1 archives with transactional identity migration; verify round trips preserve IDs and links and legacy records create no invented recoveries.
- [x] 3.2 Validate recovery-aware imports independently of the current timetable; verify duplicate IDs, missing/wrong-teacher links, links on non-RP assignments, out-of-window recovery and over-capacity fail without partial writes.
- [x] 3.3 Document archive versions, migration and rollback limitations in README; verify documented behavior matches archive and migration tests.

## 4. Permessi and candidate presentation

- [x] 4.1 Extend frontend types and Permessi API consumption for deadlines, recovered totals and dated recovery details; verify register rendering, expired/outstanding highlights, accessible labels, existing sorting/editing and responsive layout with frontend tests.
- [x] 4.2 Add RP badge, eligible balance and convenience/travel explanation to the candidate drawer; verify top/bottom order, existing profiles, blocked candidates and the exceptional heading remain correct using frontend tests and isolated UI checks.
- [x] 4.3 Refresh affected summaries after permit and assignment edits and surface protected-edit errors; verify assignment, replacement and cancellation update the Permessi register without stale balances. Document RP behavior and the inclusive one-month rule in README.

## 5. Integration and deployment verification

- [x] 5.1 Run backend and frontend suites against isolated temporary databases and complete a built-container flow covering permit creation, convenient/non-convenient RP, recovery details and cancellation; use an explicit temporary Compose override replacing the whole data mount and verify the mount before mutations.
- [x] 5.2 Recreate normal deployment with LOCAL_UID/LOCAL_GID, --build and --force-recreate and no test override; verify the project data mount and served frontend asset hash through read-only checks.

## Workflow follow-up

- Ask the user whether they want to commit before making any commit.
- Archive only when the user requests it after implementation and review.
