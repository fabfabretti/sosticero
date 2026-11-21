# Tasks

## 1. Support-aware override validation

- [x] 1.1 Add authoritative support-role context to proposal, group validation and archive validation; verify backend tests accept support moves and reject equivalent curricolare/ITP edits and forged role/type changes.
- [x] 1.2 Extend support signature accounting and dependency grouping while preserving special-activity rules; verify empty-cell moves, support/support and support/activity swaps, class/site corrections, retained room fields, unchanged multi-class lessons, rejected empty/unknown classes, duplicate/deleted hours and disabled support in focused tests.
- [x] 1.3 Make reconciliation check role eligibility as well as original affected cells; verify a changed source, destination or role suspends the whole swap while unrelated edits and legacy overrides remain valid.

## 2. Orari interaction

- [x] 2.1 Expose teacher role in the Orari frontend type and separate movement, field editing and disable permissions; verify helper/component tests keep curricolare/ITP lessons fixed and preserve existing activity toggles.
- [x] 2.2 Reuse the class/campus dialog for support, without a disable control, and enable pointer and keyboard movement/swaps; verify cancellation, known-class selection, campus choices, invalid drops and drag-release behavior with focused frontend tests.
- [x] 2.3 Update editor hints and relevant user documentation to explain support movement, conserved hours and temporary validity; verify the text matches the delivered controls and clearly leaves ordinary lesson correction outside scope.

## 3. Operational consistency and persistence

- [x] 3.1 Add API integration coverage for inclusive dates, overlap/expiry, reset/deletion and stale-preview rejection on support overrides; verify atomic failures and retained drafts using the existing preview/save contract.
- [x] 3.2 Verify moved and relabelled support hours drive compresence, absence-row identity, candidate campus checks, class-out availability and timetable/PDF data on the selected date; add regression tests proving impacted assignments and recovery evidence are retained for review.
- [x] 3.3 Verify support archive round trips, legacy archives and detached-original validation, including role differences across timetable versions; document old-binary rollback limitations and verify restart/restore preserves supported patches.
- [x] 3.4 Cover appointment inheritance and independent reception/student-group overlap in integration tests; verify edits to the imported owner reach inherited timetables while independent records remain unchanged and overlaps stay visible.

## 4. Built integration and release

- [x] 4.1 Run the relevant backend/frontend suites and build; start only a unique isolated project using exported TEST_PROJECT and mktemp TEST_DATA_DIR with `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose -p "$TEST_PROJECT" -f compose.testing.yaml up -d --build --force-recreate`. Inspect its data mount and allocated localhost port, verify `/api/environment` returns `{"testing":true}` and the red TESTING ribbon before mutations, exercise a temporary support edit and impact confirmation, then stop only that project with the same standalone Compose file.
- [x] 4.2 Deploy the verified feature with `./scripts/deploy.sh`; verify the deployed release and production mount through read-only checks and record the result. Never mutate production data for verification or restart the old local operational app.

## Workflow follow-up

- Ask the user whether to commit before making any commit.
- Archive only when explicitly requested; when consolidating specs, reconcile the earlier fixed-class-lesson wording with the scoped support exception.
