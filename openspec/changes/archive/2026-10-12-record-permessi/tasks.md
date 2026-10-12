# Tasks

## 1. Permit state and API

- [x] 1.1 Add separate permessi state and optional request-date metadata with backward-compatible loading and register/read/save/delete API operations; verify backend tests cover persistence, create/edit/delete, duplicate teacher/date, atomic identity moves and failed edits preserving the original record.
- [x] 1.2 Validate permit inputs and daily limits using all scheduled activity; verify tests cover 4/5/6-period loads, mixed lessons/POT/DIS, zero schedules, unscheduled selections within the limit, invalid references, empty lists, duplicates and boolean/out-of-range periods.
- [x] 1.3 Extend archive validation/export while preserving historical permits and retired teacher references; verify legacy import, round trip, malformed-import atomicity, changed-timetable import and backup/restore tests. Document the optional archive field and older-version limitation in the existing archive documentation or README.

## 2. Scheduling integration

- [x] 2.1 Introduce the shared effective-absence union and replace every domain absence read in rows, eligibility and automatic availability; verify tests cover permit-only rows, merged co-absence, blocked assignment, no automatic availability during permits and retained invalid assignments.
- [x] 2.2 Expose permit hours in day responses while keeping manual absences separate; verify tests show deletion preserves manual overlaps and manual absence removal preserves permits.

## 3. Permessi screen and absence controls

- [x] 3.1 Replace the Permessi stub with the register on the left and a compact left sidebar add/edit/delete form, optional request date and reserved warning/error space using existing styles and API conventions; verify frontend tests cover direct routing, table values, saving, editing, deletion, daily maximum, duplicate-entry feedback and inline errors. Update the existing Permessi placeholder expectation without regressing other routes or Settings.
- [x] 3.2 Add per-period unscheduled warnings in the form and saved table with hover and keyboard explanations; verify frontend tests cover warnings for unscheduled hours, no warning for POT/DIS, and successful save within the daily limit.
- [x] 3.3 Combine manual and permit absence identities in Assenti, showing permit hours selected and locked with accessible explanations; verify frontend tests cover manual-only toggle payloads, whole-day controls, removal and permit/manual overlap.

## 4. Integration verification

- [x] 4.1 Run backend and frontend suites and the frontend production build; verify all relevant checks pass with the new coverage and existing archive/scheduling behavior intact.
- [ ] 4.2 Rebuild and recreate the running app using `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate`; verify the container is healthy and smoke-test recording Contartase on 12/10 for periods 2/3, locked absences in Supplenze, warnings, reload persistence and deletion preserving manual overlap. Use test data or remove only records created for this check.

## Workflow follow-up

- Present the implemented result and ask whether the user wants to commit before committing.
- Archive this change only when requested after implementation and review.

## Verification note

Automated verification: 39 backend tests and 13 frontend tests passed; TypeScript/Vite production build passed. Container rebuilt and recreated with both required flags. Browser verified Contartese's 2026-10-12 permit for periods 2/3, reload persistence, locked absence controls and an unscheduled-period warning. The live overlap/cleanup script was rejected at command approval, so the live overlap portion of task 4.2 remains incomplete. The user subsequently removed the test permit. No preexisting assignments were edited.

Follow-up verification: 40 backend tests, 15 frontend tests and the production build passed after adding optional request dates and the sidebar layout. Request-date import/export, atomic move/delete and form editing are covered.
