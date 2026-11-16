# Design

## Context

See proposal.md for motivation. SQLite stores operational state as one JSON document. `Store.write` is the common write boundary; `save_state` is not universal: timetable reconciliation, staffing, imports and initialization also write state directly. Mutation endpoints use immediate transactions and record preconditions. Inbox also saves operational state. Physical backup restore replaces the database outside this boundary. The daily table has two immediate removal controls and already uses native confirmation dialogs elsewhere. Existing loading/cache changes are unrelated working-tree edits.

## Goals / Non-Goals

**Goals:** Explain committed changes by record and request without duplicating private document contents; protect both explicit assignment removal controls with minimal interaction cost.

**Non-Goals:** Prove the historical incident, audit every application field, add a viewer or new service, automatically undo changes, or redesign existing import/restore confirmations.

## Decisions

### 1. Journal the persisted diff at the shared write boundary

Add an `operational_audit` table in the existing operational database. Compare old and new allowlisted projections when `Store.write` writes `state`, using the same connection/transaction as the state write. Audit only changed record projections in `asg`, `abs`, `cf`, `dis` and `disSites`; exclude reads, unchanged writes and private-field-only updates. This catches direct writers and reconciliation side effects that endpoint-only logging would miss. Never mutate input state or expose the journal through existing JSON import/export APIs.

One event identifies a changed group/date/record and stores UTC timestamp, event ID, request correlation ID, source operation, actor account ID plus username/name snapshot when authenticated, before/after projections and available campus context. Assignment projections include substitute ID, type, class, permit reference and communication/acceptance/notification metadata, including campus-notice metadata. Entry projections contain hours and site only. No free-text notes, attachment contents/references, cookies, credentials, raw request bodies or full timetable rows. IDs are sufficient for investigation through the current or backed-up catalog.

Keep journal insertion transactional: failure rolls the operational write back and returns an error, rather than reporting an untraceable successful mutation. Test rollback after journal insertion as well as insertion failure. Multiple changed records can share a correlation ID; persisted no-op writes generate no events.

### 2. Server-derived attribution and separate request outcomes

Use a small scoped context (for example a ContextVar populated around the existing authenticated request flow) propagated to synchronous endpoints and workers. Generate a request ID server-side and expose it in a response header. Do not accept actor identity or source from request bodies. Clear context reliably; initialization and background work use explicit system sources, never the previous request's account.

For mutation failures and rejections on relevant operational routes, emit a structured application-log outcome with request ID, UTC time, safe route template, actor if authenticated, HTTP status and a fixed error category. Extract only validated record identifiers when available; never log arbitrary exception messages or validation payloads. These outcomes are not successful journal events. Missing/invalid authentication must still be safe to log without identifying an account. A disconnected client can have a committed event even without receiving success; the journal is authoritative for commit status.

An endpoint-only journal was rejected because direct/bulk writes would be missed. A separate journal database was rejected because it cannot share an atomic commit with operational data. Logging full state was rejected for privacy and volume.

### 3. Small confirmation using existing browser behavior

Use one shared removal path for the table × and review-issue Rimuovi button, with `window.confirm` and an Italian description containing substitute/action, date, period and class, using preserved issue context or stable identifiers when labels are unavailable. Rename the generic Svuota accessible label to describe removal and show the Shift+click hint. Normal mouse, touch and keyboard activation require confirmation. Only an actual pointer click with Shift held bypasses it; Shift+Enter/Space must not accidentally bypass confirmation.

Capture the displayed assignment's preconditions and global generation before opening confirmation and submit that captured baseline after acceptance. Do not recalculate expected tokens from a refreshed snapshot. A remote replacement while the prompt is open must return the existing conflict rather than deleting the new record. Shift+click uses the same authorization, busy/readiness and precondition checks. No extra confirmation for replacing candidates, toggling flags or existing separately confirmed bulk operations.

### 4. Server-only access and explicit retention/restore limits

No HTTP endpoint or application screen is added. Document read-only SQLite queries filtering by date, record/teacher and request ID, with before/after detail. Proposed operational default: retain 90 days of events, pruning older timestamps in a bounded batch on audited writes, using a timestamp index; no timer service. Keep schema versioning for event payloads so later additions remain readable.

SQLite backups include this table; JSON archives do not. Importing school data preserves journal history and journals changed tracked projections. Physical backup restore necessarily rewinds the table with the rest of the database. Preserve the existing pre-restore safety snapshot and emit correlated restore-start/success/failure application-log markers without filenames or payloads supplied by clients. Document that post-backup journal evidence must be queried in the safety snapshot after a restore; older backups without the table initialize an empty journal. This version is diagnostic, not a tamper-proof or restore-independent audit service. No historical events are invented at upgrade.

## Risks / Trade-offs

- [Full state comparison overhead] → Compare only tracked projections at existing state writes; index event time and request ID, avoid read logging and full dataset serialization.
- [Audit storage failure blocks an operational mutation] → Roll back atomically, return the existing save-error feedback, and emit a sanitized correlated failure; test disk/insertion-failure behavior.
- [Stale confirmation deletes a newer assignment] → Capture the original preconditions and generation; test a concurrent replacement while confirmation is open.
- [Context leaks between requests or Inbox work] → Explicit scopes/reset and tests with multiple accounts and worker writes.
- [Row visibility changes without assignment changes] → Include absences/class-out changes and document preserved orphan/review rows; no fabricated deletion event.
- [Retention or physical restore removes active-history evidence] → State the 90-day live window and backup/safety-snapshot lookup procedure; use bounded pruning, never delete whole backups for this journal.
- [Unrelated loading work is accidentally included] → Preserve those edits, review the final deployment source scope before release and verify the combined build when implementation is requested.

## Migration Plan

Create the additive table/indexes only during explicit Store initialization, preserving all operational records and import-without-side-effects behavior. Validate old-database initialization, school-data imports, backups and older-backup restore on temporary databases. Run focused backend/frontend checks and a production build; verify the unique isolated Compose project, temporary mount, allocated port, testing environment and red ribbon before behavioral writes. Stop that project afterward. Deploy implementation with `./scripts/deploy.sh`, then perform read-only release/mount and schema checks. Planning alone is not deployed. No automatic code/data rollback or production behavioral test; ask before committing.
