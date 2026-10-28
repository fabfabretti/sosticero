# Tasks

## 1. Read-only availability API

- [x] 1.1 Add the hour/campus consultation computation using existing eligibility, policy and RP rules with no target class; verify focused temporary-data domain tests cover POT, manual/automatic availability, hidden and occupied types, absent/retired/assigned teachers, unknown campuses and RP transfer eligibility for both campuses.
- [x] 1.2 Add authenticated GET `/api/availability`, validated date/hour/campus inputs and existing teacher display-name overrides; verify API tests cover both campus filters, Entrambe, effective timetable dates, invalid inputs, unauthenticated rejection and authenticated consultation without assignment rights, with unchanged stored state and RP ledger.

## 2. Empty-hour consultation UI

- [x] 2.1 Add “Consulta disponibilità” to the existing filtered empty-hour row and open with the selected day/hour/campus directly; verify frontend regression checks cover all seven empty hours, an hour populated only in the other campus and unchanged actual substitution rows/counts.
- [x] 2.2 Extend the drawer with a read-only consultation context, teacher/type/campus presentation, loading/error/empty states and stale-request protection; verify frontend checks cover Centrale, Succursale, labelled Entrambe/unknown groups, absence of write/manual-option controls and context changes without stale results, then run the frontend build.

## 3. Integrated verification

- [x] 3.1 Build and recreate a unique isolated `compose.testing.yaml` project with a `mktemp -d` data directory and required UID/GID; inspect its mount and allocated localhost port, verify `/api/environment` reports testing and the red TESTING ribbon, then check campus-specific empty-hour consultation, keyboard close/focus, no data changes and normal real-row assignment behavior on disposable data. Stop only this test project afterwards.

## Workflow follow-up

- Ask the user whether to commit before committing any work.
- Deploy only when authorized, using `./scripts/deploy.sh`; keep server checks read-only.
- Archive after implementation and review are complete.
