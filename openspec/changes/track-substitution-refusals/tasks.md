# Tasks

## 1. Persistent history and archive compatibility

- [x] 1.1 Add the separate date/row refusal-history collection, default loading and validation, including professor ID/name snapshots and per-professor deduplication; verify isolated-database tests cover missing legacy state, restarts, unresolved names and temporarily missing rows without losing history.
- [x] 1.2 Export schema 12 and update all relevant import schema branches/contracts while retaining schema 1–11 support; verify backup/archive round trips, empty legacy history, malformed/duplicate history rejection and atomic restore failure in backend archive tests.
- [x] 1.3 Document refusal history persistence and schema-12 compatibility in the existing archive/user documentation; verify the documented backup behavior matches the passing round-trip tests.

## 2. Atomic refusal and accounting

- [x] 2.1 Add an explicit mutually exclusive refusal mutation for saved RP/PAID assignments, derive identity from the server and atomically save history plus release; verify API tests cover unsupported categories, invalid mixed payloads, campus denial, existing acceptance, rollback, repeated requests and successful release.
- [x] 2.2 Extend row/group preconditions to cover refusal history and all affected assignment contexts, then implement entire-campus-notice refusal; verify backend concurrency and campus-notice tests cover two-hour release, group/member changes, replacement protection, unauthorized rows, no duplicate history and unrelated assignments remaining intact.
- [x] 2.3 Verify existing save_state accounting against refusal flows with isolated integration tests: RP permit unchanged and recovery capacity restored, paid records/budget/statistics reduced, and deliberate reassignment using fresh statuses while prior history survives. Fix only integration needed for these outcomes.

## 3. Daily table controls and notes

- [x] 3.1 Add Rifiutata actions to RecoveryActions, PaidActions and CampusNoticeActions using existing busy/campus protections; verify component tests cover callback/payload intent, disabled controls, keyboard-accessible buttons and explicit whole-notice scope for campus groups.
- [x] 3.2 Wire mutations and render small red past-tense refusal text independently below the assignment selector; verify sidebar/session tests cover unassigned and reassigned rows, multiple unique names, name fallback, date isolation, refreshed statuses, stale-request feedback and unchanged entry/exit controls.
- [x] 3.3 Document the operator flow, grouped scope, intentional reassignment and row-identity limitation; verify examples correspond to tested behavior and public display/export views do not inadvertently show internal refusal notes.

## 4. Integration verification and deployment

- [x] 4.1 Run appropriate backend/frontend suites and build; create a unique TEST_PROJECT and mktemp TEST_DATA_DIR, start only compose.testing.yaml with the prescribed UID/GID command, inspect its mount/allocated port and verify /api/environment testing=true plus the red TESTING ribbon before behavioral edits. Verify refusal/replacement/reload and grouped release visually at desktop and narrow widths, then stop only this test project and record results.
- [x] 4.2 Deploy the verified feature with ./scripts/deploy.sh; verify release identity, served asset hash, health and production mount using read-only checks and record the outcome without creating production test records.

## Workflow follow-up

- Ask the user whether to commit before making any commit.
- Archive only when the user requests it after implementation and verification.
