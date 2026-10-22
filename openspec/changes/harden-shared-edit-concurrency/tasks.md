# Tasks

## 1. Atomic operational preconditions

- [x] 1.1 Add canonical per-record/existence tokens to consistent day and permit reads, and required preconditions to covered write models; verify token stability, metadata sensitivity, missing-precondition rejection and unrelated-record independence in temporary-database tests.
- [x] 1.2 Check entry creation/replacement/deletion and all range/future targets before mutation inside existing transactions; verify stale hour lists, duplicate additions, deleted/recreated entries, future date-set changes, metadata and attachment rollback with focused API tests.
- [x] 1.3 Check dated permit source/destination and manual balance preconditions while preserving recovery protections; verify concurrent edit/delete/move cases, duplicate creation and linked-recupero integrity.
- [x] 1.4 Check assignment record/row context preconditions for assignment, removal, communicated status and conflict reassignment; verify stale actions and retain simultaneous global double-booking and final-recupero-hour tests.
- [x] 1.5 Update every frontend mutation caller and backend test helper for the new contract; document 409/428 behavior and verify a search of all covered endpoint callers finds no unconditional write path.

## 2. Inbox outcomes and conflict recovery

- [x] 2.1 Return explicit already-processed outcomes from Inbox transactions and display saved decisions after accept/ignore races; verify different teacher/metadata payloads cannot appear applied twice and existing rollback tests pass.
- [x] 2.2 Add shared-record conflict handling to existing immediate controls and saved forms without automatic replay or silent baseline replacement; verify immediate controls show current saved values and form input survives until explicit reconciliation.
- [x] 2.3 Verify Inbox addition invalidates stale manual absence replacements while preserving additive merging, notes and attachment behavior; add a focused interleaving test and document the user-facing conflict messages.

## 3. Noninterrupting operational refresh

- [x] 3.1 Add non-overlapping Supplenze/Permessi polling and visibility-return refresh with date/mutation response guards; verify out-of-order responses, unchanged polls, failures and unmount cleanup with focused frontend checks.
- [x] 3.2 Defer affected snapshots during existing entry forms, metadata editors and candidate drawers, preserving DOM identity, focus and all scroll containers; verify updates resume after the interaction and existing save semantics remain unchanged.
- [x] 3.3 Document the refresh interval, deferred-update behavior and global import/restore limitation; verify documentation matches the implemented polling and conflict behavior.

## 4. Isolated integration verification

- [x] 4.1 Run relevant backend/frontend suites and the frontend build; verify concurrency fixtures use temporary databases and no operational data is opened or changed.
- [x] 4.2 Start a uniquely named standalone compose.testing.yaml project with mktemp data, inspect mounts/allocated port and verify testing=true and the red ribbon before two-browser checks; verify teacher assignment races, shared edits and Inbox races across clients.
- [x] 4.3 In both browsers verify quiet updates preserve page/sidebar scroll, focus, selected date/filter, open candidates and typed metadata/permit values; verify a newly absent substitute appears as a review issue, then stop only this test project.

## Workflow follow-up

- Implement this change before add-campus-authentication.
- Ask whether to commit before committing. Deploy to normal service only with authorization, using the required rebuild/recreate command and read-only mount/bundle checks.
