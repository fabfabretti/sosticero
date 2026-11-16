# Tasks

## 1. Transactional operational journal

- [ ] 1.1 Add the journal table/indexes and versioned allowlisted projections at the common state-write boundary; verify temporary old databases initialize without changing operational records and backend imports still have no database side effects.
- [ ] 1.2 Record changed assignments/flags, absences, class-out entries and manual availability/sites on the same connection as the state write; add focused tests for create/update/delete, no-op/private-only changes, audit insertion failure and transaction rollback, proving state/events commit together.
- [ ] 1.3 Cover direct state writers, imports, staffing, timetable reconciliation and Inbox through the shared boundary; add representative integration regressions proving bulk changes are attributed, unchanged assignments survive unrelated edits and changed row visibility produces no false deletion event.
- [ ] 1.4 Add 90-day retention with indexed bounded pruning; verify recent events survive, old events are pruned incrementally and JSON export/import excludes/preserves journal history respectively.
- [ ] 1.5 Document event fields, privacy exclusions and read-only SQL investigation by day/record/teacher/request ID in `docs/operational-audit.md`; execute the documented queries against a disposable database with a synthetic assignment lifecycle.

## 2. Request attribution and failure diagnostics

- [ ] 2.1 Add server-generated correlation IDs and scoped authenticated/system attribution around existing request/worker flows; verify two concurrent accounts, initialization and Inbox do not share actor context and response IDs match committed events.
- [ ] 2.2 Emit separate sanitized outcomes for relevant failed/rejected mutations, including authentication, validation, authorization, conflict and database errors; verify outcomes have safe categories/status/IDs, create no success events and contain no private notes, attachments, tokens or raw exception payloads.
- [ ] 2.3 Add correlated restore lifecycle diagnostics and verify current and pre-journal backups restore under existing coordination with a retained safety snapshot; test failure outcomes and journal reinitialization without fabricated history, and document the safety-snapshot lookup/90-day limitations alongside read-only investigation.

## 3. Lightweight assignment removal confirmation

- [ ] 3.1 Route table × and review Rimuovi through one contextual confirmation path, with descriptive accessible labels and a Shift+click hint; add frontend interaction checks for accept/cancel/Esc, preserved-context fallback, pointer shortcut, touch/keyboard confirmation and no extra prompts on flag changes.
- [ ] 3.2 Capture the original assignment preconditions/global generation before confirmation and retain existing permission/readiness/busy guards for both paths; verify remote replacement and restore during an open confirmation are rejected without deleting newer data, and document shortcut semantics in the operational guide.

## 4. Integrated verification and release

- [ ] 4.1 Run the backend and frontend regression suites and production frontend build after preserving existing loading/cache edits; record outcomes and inspect the final source diff for unintended changes or private diagnostic data.
- [ ] 4.2 Rebuild only a unique `compose.testing.yaml` project with exported unique TEST_PROJECT, mktemp TEST_DATA_DIR and LOCAL_UID/LOCAL_GID using the prescribed up command; inspect mount/allocated port and verify testing=true/red ribbon before synthetic writes, exercise both removal paths and read-only journal lookup, and stop only that test project afterward. Record results in the change verification notes.
- [ ] 4.3 Deploy the implemented and verified change using `./scripts/deploy.sh`; verify release/source marker, production data mount and additive journal schema with read-only checks, without creating production test records. Record the release and checks; ask the user before any commit.
