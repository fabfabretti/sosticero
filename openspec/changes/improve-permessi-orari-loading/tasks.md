# Tasks

## 1. Establish the baseline

- [x] 1.1 Create reproducible representative synthetic data in a temporary isolated database with many teachers, permit records and historical boundaries; record baseline permit preparation/serialization time, response bytes (plain/compressed), Orari first usable grids and browser long tasks under stated conditions in a performance verification note.

## 2. Compact Permessi data with identical behavior

- [x] 2.1 Implement the compact effective-history projection, reuse one history read and avoid duplicate boundary resolution; verify equivalence to full effective datasets across imports, overrides, staffing/absence start and end dates, initial history, retired teachers, mixed/disabled activities and weekly site labels using focused backend tests.
- [x] 2.2 Update the permit endpoint and every frontend/test consumer to compact teacher/hour/site lookups while retaining the single-request flow, metadata, recovery balances and concurrency baselines; verify sidebar suggestions, limits, warnings, saved-row labels, sorting/pagination, manual balances and edit/move/reset behavior with focused frontend and existing permit/recovery/concurrency tests.
- [x] 2.3 Repeat the baseline permit measurements and document before/after values and any remaining preparation bottleneck; verify full historical lesson datasets are absent and the representative payload is smaller without changed computed results.

## 3. Progressive Orari rendering

- [x] 3.1 Add cancellable bounded batches with an initial usable prefix and an accessible end loader using existing styles; verify with controlled scheduled-callback tests that rendering yields, completes without scrolling, and leaves accepted cards usable.
- [x] 3.2 Preserve complete-list search, stable keys, visible prefixes on same-date refresh and existing draft/scroll handling; verify pending-teacher search, filter clear, edits during appends, quiet refresh, rapid date switches and cleanup on unmount with focused tests.
- [x] 3.3 Verify PDF export during partial rendering still contains every eligible saved teacher and retains existing draft/date-loading restrictions; run focused export tests and record browser first usable grids, long tasks and responsiveness against the baseline.

## 4. Integration and release

- [x] 4.1 Run the appropriate backend/frontend regression suites and production build; verify passing results and document any pre-existing failures separately.
- [x] 4.2 Build/recreate only a unique isolated `compose.testing.yaml` project with an exported mktemp data directory, required UID/GID variables and explicit project name; inspect mount and allocated port, verify testing=true and red TESTING ribbon before behavioral checks. Verify both pages on desktop/mobile and both themes, including scroll/focus during progressive rendering, then stop only this project and record completion.
- [x] 4.3 Deploy with `./scripts/deploy.sh` and verify the deployed source marker, assets, production environment and release using read-only checks; record the release and measured results without changing production records. Ask the user before any commit.

## 5. Correct the remaining initial-load delay

- [x] 5.1 Measure complete API response time and browser initial rendering on an isolated SQLite online backup of the authoritative data; identify calculation, encoding and card preparation costs and record the baseline without production writes.
- [x] 5.2 Remove redundant timetable copying and any measured redundant response encoding while preserving detached resolver results and identical API JSON; verify focused backend tests and before/after representative timings.
- [x] 5.3 Defer Orari card preparation as well as mounting; verify unrendered cards are not prepared, complete search/export still work, drafts/focus/scroll survive and all cards finish automatically.
- [x] 5.4 Run appropriate regression/build checks and isolated browser verification, stop the isolated test project, deploy with `./scripts/deploy.sh`, and verify the exact production release using read-only checks; record measured improvement and limitations.
