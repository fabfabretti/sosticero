# Tasks

## 1. Paid declarations and campus calculation

- [x] 1.1 Add paidAvailability state defaults, declaration validation and per-teacher/weekday concurrency tokens; verify isolated backend tests for valid edits, invalid inputs, duplicate slots, legacy defaults, shared-account editing and stale-save rejection.
- [x] 1.2 Reuse/extract existing travel checks for paid campus feasibility without requiring recovery debt or favourability; verify both-side transfer tests, breaks 2–3/4–5, no commitments, missing campuses, receptions and occupied declared slots, plus existing RP regressions.
- [x] 1.3 Add dated weekly declaration read/edit endpoints and quiet-refresh metadata; verify version/override boundaries within a week and that changes preserve saved assignments.

## 2. Explicit paid assignment lifecycle

- [x] 2.1 Extend candidate generation, sorting and assignment input/validation with explicit PAID selection while preserving legacy omitted-category behavior; verify duplicate RP/paid offers, section order, ascending paid totals including future bookings and deterministic ties.
- [x] 2.2 Implement atomic paid saves, same-teacher category switches, provenance, notification state and assignment-derived register/totals; verify RP release/consumption, failed-switch rollback, unchanged resaves, replacements/removal and simultaneous cross-campus double-booking prevention.
- [x] 2.3 Add Avvisato mutation with existing assignment preconditions and target-campus permissions; verify wrong-campus rejection, stale updates, preservation of provenance and that notification changes never alter totals.
- [x] 2.4 Extend archive export/import, saved context and assignment review/statistics consumers for PAID; verify round trips, legacy imports, malformed metadata atomic rejection, retired-teacher history and persistence after declaration/timetable changes. Document the paid data fields and accounting semantics alongside existing operational documentation.

## 3. Banca ore and selection UI

- [x] 3.1 Replace the placeholder with a dated reference-week grid and explicit edit mode using existing UI patterns; verify adding/removing recurring slots, computed campus labels, unknown/occupied reasons, keyboard access, narrow layout and preservation of active edits during remote refresh.
- [x] 3.2 Render the paid register and per-teacher totals below the grid; verify past/future entries, assigning account, saved historical context and refresh after assignment removal/replacement.
- [x] 3.3 Carry teacher/category through frontend types, candidate keys, current-selection markers, consultation, assignment callbacks and conflict refresh; verify each duplicate teacher choice saves its own category, section ordering and count display, and run frontend build/tests.
- [x] 3.4 Add per-assignment paid request formatter and Avvisato/clipboard controls only in the Supplenze table, following permit recoveries; verify the Banca ore register has neither control, and verify exact substitution details, paid wording, missing-room fallback, clipboard failure feedback, permission handling and no grouped requests or implicit notification changes.

## 4. Theoretical Stats extension

- [x] 4.1 Add paid opportunities to backend availability reports using dated neutral timetable state; verify union deduplication across ordinary/RP/paid, both campuses, unknown-campus warnings, occupied slots, daily-state independence and unchanged POT ratios.
- [x] 4.2 Add the third Stats mode and accessible category/campus breakdown, method explanation and print support; verify week/campus controls, overlapping-category counts, tooltip interaction and existing modes. Document the distinction between theoretical capacity and actual candidate eligibility.

## 5. Integration verification

- [x] 5.1 Run relevant backend regression suites, frontend tests and production build against isolated temporary data; verify recovery accounting, authorization, concurrency, archives and existing assignment category consumers remain compatible.
- [x] 5.2 Rebuild/recreate only a uniquely named compose.testing.yaml project with a mktemp TEST_DATA_DIR, LOCAL_UID/LOCAL_GID and explicit -p; inspect mounts and allocated localhost port, verify /api/environment testing:true and red TESTING ribbon before behavioral checks, exercise duplicate-category selection, grid/register/email/Stats flow, then stop only that test project.

## Workflow follow-up

- Ask the user whether to commit before any commit.
- Deploy only a subsequently authorized server update using ./scripts/deploy.sh; keep deployment checks read-only and never restart the old local operational app.
