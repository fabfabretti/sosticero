# Tasks

## 1. Override storage and presentation

- [x] 1.1 Add validated per-ID override storage and atomic set/edit/remove operations without state reconciliation; verify invalid/stale requests fail and missing overrides preserve current behavior using temporary databases.
- [x] 1.2 Add shared presentation/search support across Orari, day responses, candidates, Permessi, Inbox and PDF projection; verify labels are consistent while imported datasets, digests, saved evidence and operational records remain unchanged.
- [x] 1.3 Add Orari's two-name editor with Save/Cancel/Remove and struck-through imported name; verify cancellation, reload, both-name search and the shared-account explanation, including the Binotto Steven correction fixture.

## 2. Inbox and portability

- [x] 2.1 Add case/whitespace-normalized alias matching deduplicated by ID; verify either name matches, cross-ID collisions require selection, inactive-date validation remains enforced and accepted items are unchanged after edit/removal.
- [x] 2.2 Extend archive export/restore for overrides and legacy retention rules; verify new/legacy round trips, empty overrides, invalid-reference atomic rejection, same-ID timetable imports, dormant missing teachers and temporary SQLite backup preservation.

## 3. Preservation and integrated verification

- [x] 3.1 Run focused regression checks with permits, manual balances, RP assignments, absences and statistics; verify exact equality of stored operational documents and accounting results before/after override save/edit/remove, and run the relevant existing backend/frontend suites.
- [x] 3.2 Build/recreate a unique standalone testing Compose project using exported TEST_PROJECT and mktemp TEST_DATA_DIR; verify its mount, allocated localhost port, testing endpoint and ribbon before UI/API mutations, then verify Orari, Supplenze selection, Inbox aliases and PDF names and stop only this test project.

## Deferred work

- Separate original/supplente permits and recovery accounting; no account separation is implemented by this change.
- The earlier `prototype-dated-teacher-replacements` plan is superseded and must not be implemented as a dependency.

## Workflow follow-up

- Ask the user whether to commit before committing.
- Deploy to normal service only when approved, rebuilding/recreating against the operational data directory and verifying mount and assets read-only.

## Verification results

- Backend: 162 regression tests exercised; 161 passed initially, and the remaining archive test passed after its unsupported-version fixture was updated from schema 6 to 7.
- Frontend: all 105 tests passed; TypeScript/Vite build succeeded.
- Isolated container: verified temporary /data mount, allocated port 45977, testing endpoint and red ribbon; exercised save/remove, imported-name search, Inbox aliases, candidate assignment and exported PDF text. Test project stopped; normal container remained on the project data mount.
- Preservation tests compare stored operational documents, imported history, timetable basis, scheduling results, permit IDs, RP links and accounting through name edits.
