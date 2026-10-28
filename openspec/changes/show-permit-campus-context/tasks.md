# Tasks

## 1. Persist creator campus

- [x] 1.1 Add permitCreators to state initialization, authenticated permit creation, moves/deletion, GET response and concurrency metadata. Add focused temporary-database tests for each campus creating a permit, cross-campus edits/moves preserving provenance, legacy edits remaining unspecified and deletion cleaning metadata; run those tests.
- [x] 1.2 Extend archive export/import and validation for optional creator metadata. Add and run regression tests for round trips, missing legacy metadata, invalid campus values and dangling references failing atomically; verify persistence across app reload and the existing backup path.

## 2. Update the register

- [x] 2.1 Add Sede lezioni and Inserito da columns to the dated-permit table, deriving known sites across the whole weekly timetable effective on each permit date and displaying unspecified values as a dash. Reuse campus colour tokens and accessible C/S tags. Verify a teacher at both sites on different weekdays, single-site/unknown teachers, historical timetable selection and full accessible campus labels with a focused check using the existing frontend test setup or a small assert-based self-check.
- [x] 2.2 Remove Scadenza recupero and Ore recuperate cells/headers; strike through data for individually completed permits while keeping controls usable. Verify a completed permit alongside another outstanding permit for the same teacher, preserved recovery details/Scadute indications and unchanged manual-balance table; run the frontend build.

## 3. Integration verification

- [x] 3.1 Rebuild and recreate only a uniquely named isolated compose.testing.yaml project with a mktemp data directory and the AGENTS.md command. Inspect its mount and allocated localhost port, confirm /api/environment reports testing:true and the red TESTING ribbon before mutation, then check creation from both campus accounts, cross-campus editing, compact table layout in both themes and at narrow widths. Tear down only this test project afterward and record the result.

## Verification results

- 2026-10-28: 24 selected backend tests passed (creator provenance, classification, recovery and backup suites), all 20 frontend test files passed, and the frontend production build succeeded.
- Isolated project sosticero-permits-1793199724 used /tmp/sosticero-permits.MsWuvS at localhost:45769. Inspected /data bind mount, confirmed testing:true and the red TESTING ribbon before fixture changes.
- HTTP checks covered both creator campuses, cross-campus editing and a recovery completing one permit while another remained outstanding. Browser checks covered tags, removed columns, completed-row styling, light/dark themes and narrow table overflow.
- The isolated Compose project was stopped and removed after verification. Production was untouched; no deployment or commit was performed.
