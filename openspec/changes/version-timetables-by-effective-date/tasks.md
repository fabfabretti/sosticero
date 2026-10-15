# Tasks

## 1. Timetable history and date selection

- [x] 1.1 Add immutable baseline and dated versions in existing storage; test idempotent migration preserves dataset, operational state and facts exactly and imports have no database side effects.
- [x] 1.2 Add date selection and interval calculation; test baseline, boundary dates, future activation, backdated insertion before another version and duplicate-date rejection.
- [x] 1.3 Update daily/candidate endpoints, date-range entries, assignment validation, permit moves, availability and identity catalogs to use the correct date; test operations spanning versions and retired historical identities.
- [x] 1.4 Document baseline limits and stable ID/full-file requirements in README; verify examples match date selection and the unchanged timetable JSON format.

## 2. Reviewable and atomic import

- [x] 2.1 Implement non-mutating preview of interval, recorded dates, demand, assignments and teacher inventory differences; test additions/removals, malformed input and unchanged database contents after preview.
- [x] 2.2 Add collision-safe online backups with integrity verification and confirmed apply under guarded snapshot; test same-second backups, backup failure, lock timeout and failure rollback.
- [x] 2.3 Bind confirmation to input/date/relevant database fingerprint; test concurrent operational, settings and timeline changes reject stale previews, and existing production/testing protections remain enforced.
- [x] 2.4 Document preview/apply API and backup failure behavior; verify documented requests against an isolated TestClient database.

## 3. Conflict preservation and statistical reconciliation

- [x] 3.1 Preserve original context for invalid/orphan assignments and missing references; test changed class, campus, busy substitute and merged-row identity changes without deleting entries, notes or links.
- [x] 3.2 Add explicit interval reconciliation of dated facts and retained correction evidence; test affected future and backdated facts, unchanged outside dates, no stale-context restoration and exclusion of invalid coverage.
- [x] 3.3 Preserve RP ledger accounting during imports and support explicit conflict resolution using existing validation; test permit links, protected removal/replacement and no double credit.
- [x] 3.4 Document conflict and statistical correction semantics, including RP review; verify examples against the regression cases.

## 4. Portable history and recovery

- [x] 4.1 Add version-aware archive export/import with complete timeline, correction evidence and per-date reference validation; test exact round trip and atomic rejection of malformed dates, duplicate versions and broken references.
- [x] 4.2 Keep legacy schemas supported without replacing existing history; test reconstructed provenance, historical teacher/class references and incompatible archive rejection; document legacy limitations.
- [x] 4.3 Verify database backup and confirmed restore recover baseline, versions, state, facts and RP links together using a temporary database; document recovery and code/schema rollback compatibility.

## 5. Import and conflict interface

- [x] 5.1 Add effective-date input, impact preview, historical warning, ID inventory differences and explicit apply/cancel to Settings; test date default, stale preview, errors, cancellation and keyboard accessibility.
- [x] 5.2 Display active timetable version on daily views and actionable unresolved assignments with original context; test valid retained assignments, disappeared rows and explicit validated resolution.
- [x] 5.3 Update frontend types and user instructions for full JSON version imports and conflict review; verify frontend tests and production build succeed.

## 6. Integrated verification

- [x] 6.1 Run backend/frontend regression suites on isolated databases; verify current absence/permit notes, recovery accounting, statistics and archives remain compatible with other completed changes.
- [x] 6.2 Rebuild and recreate a unique standalone compose.testing.yaml project using mktemp data and allocated localhost port; inspect mount, verify testing=true and red TESTING ribbon, then exercise import/preview/conflict/restore across version boundaries and stop only this project.
- [x] 6.3 Record verification evidence and realistic-data reconciliation duration; verify normal service remains untouched and no test data or Compose overrides became defaults.

## Workflow follow-up

- Ask the user whether to commit before creating any commit.
- Deploy an approved implementation with the required normal Compose build/recreate command; verify the project data mount and served frontend asset hash read-only.
- Coordinate the durable-facts delta with implement-stats-page before syncing or archiving; archive only after implementation and review.
