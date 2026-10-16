# Tasks

## 1. Connection and credential storage

- [x] 1.1 Add nonsecret connection settings and bounded credential upload APIs, server-chosen key path beside the selected database, structural/key validation, fixed Google endpoints, atomic replacement and restricted permissions; verify temporary-directory tests reject invalid uploads without replacing a valid key and never return secrets.
- [x] 1.2 Add the minimal pinned Google authentication transport dependency and read-only worksheet fetch/test with timeouts; verify fake-transport tests for success, denied access, malformed layout and safe error messages, and verify dependency installation.
- [x] 1.3 Explicitly ignore data/keys and verify container context, JSON export and SQLite backup/download exclude key material; add restore tests showing installed keys survive and missing-key installations remain disconnected. Document key upload, Viewer sharing and fresh-machine setup alongside existing setup documentation.

## 2. Durable response discovery

- [x] 2.1 Add additive Inbox schema and source-scoped full-row identity with occurrence ordinals; verify first-sync-all, repeated fetch, identical rows, row deletion/reordering, new append and restart fixtures without calendar changes.
- [x] 2.2 Parse the supplied eight-column response matrix with duplicate date headers, Italian timestamps/dates and three case branches; verify supplied examples, weekend ranges, invalid/missing values, unsupported periods, one-year limit and empty weekday ranges with focused fixtures.
- [x] 2.3 Start cancellable, nonoverlapping 30-second polling through app lifespan with immediate configured sync, bounded backoff and persistent safe status; verify lifecycle/no-import-side-effect tests, failure recovery and multiple client reads causing no extra Google requests.
- [x] 2.4 Document append-only assumptions, deleted test-row behavior, identical-response identity limitation and restore rewind; verify source change and backup restore tests retain consistent source-scoped history and reload polling configuration safely.

## 3. Review and acceptance APIs

- [x] 3.1 Add pending/history list, summary and preview with exact unique name resolution, optional teacher selection and per-date effective timetable validation; verify unmatched/ambiguous/inactive teacher tests and overlap previews including permit-derived hours.
- [x] 3.2 Implement transactional acceptance using the existing absence save/statistics path and union semantics while preserving metadata; verify partial/full overlap, whole-day/range, untouched notes/classification/attachments, permit recovery preservation and statistics consistency tests.
- [x] 3.3 Add atomic ignore and idempotent acceptance status handling; verify concurrent acceptance, stale acceptance after ignore, rollback on any invalid date, restart history and manual correction surviving subsequent polling. Verify existing manual replacement behavior remains unchanged.

## 4. Settings and Inbox interface

- [x] 4.1 Add source fields, JSON file upload, connection test, account email and sync status to Settings using existing styles; verify frontend tests cover upload/error states and no secret echo, and document first connection importing every existing response.
- [x] 4.2 Add the Inbox route/tab and pending/history review interface with preview, teacher selection, Accetta and Ignora; verify route/reload/history and action/error tests, and visually inspect responsive light/dark layouts and keyboard operation.
- [x] 4.3 Add isolated Shell summary polling, pending badge and persistent Apri Inbox notice with polite status announcements; verify active form values, selection and focus survive new responses and no modal or automatic navigation occurs. Preserve all existing destinations.

## 5. Integration verification

- [x] 5.1 Run existing backend/frontend tests and frontend build, resolve feature regressions, and verify no existing operational records or unrelated working-tree edits are changed.
- [x] 5.2 Rebuild/recreate a unique standalone compose.testing.yaml project with an mktemp data directory and fake source; inspect its mount/allocated localhost port, verify /api/environment reports testing:true and the red TESTING ribbon before behavioral writes, then exercise discovery, notification, accept/ignore, restart and manual correction. Stop only that project and leave normal service untouched.

## 6. Follow-up refinements

- [x] 6.1 Render compact rows with names first, conditional teacher selectors and source submission times; verify frontend tests and isolated desktop/mobile browser checks.
- [x] 6.2 Append import provenance notes once while retaining manual notes, including already-recorded hours and ranges; verify isolated Inbox tests.
- [x] 6.3 Synchronize badge updates with list refresh, reject stale summaries and add a gesture-enabled new-entry chime; verify race/sound tests, backend received-count tests and isolated browser count/action checks.

## Workflow follow-up

- Live Google verification requires the user to upload credentials through the implemented Settings UI; do not read an arbitrary downloaded key or ingest the real response sheet during automated tests.
- Ask whether the user wants to commit before committing any work.
- If normal deployment is approved, use LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate and perform read-only mount and served-asset checks; keep behavioral tests isolated.
