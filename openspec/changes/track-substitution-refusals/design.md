# Design

## Context

See proposal.md for motivation. Assignment metadata currently lives inside state.asg; removing or replacing an assignment removes its metadata. RP links drive recovery use, and paid assignments drive records and budget totals. Campus notices are derived groups identified by a content fingerprint, with statuses stored on each member. The assignment endpoint already uses BEGIN IMMEDIATE, campus checks and content preconditions. Portable exports currently use schema 11 and import state through storage.EMPTY.

This is a cross-cutting storage, transactional API and UI change, so a design artifact is required. Existing unrelated loading/cache changes and the separately proposed operational audit log must be preserved.

## Goals / Non-Goals

**Goals:** Separate durable refusal context from active assignments; reuse assignment removal's derived accounting; make grouped refusal atomic and concurrency-safe.

**Non-Goals:** General audit UI, refusal reasons, history editing/deletion controls, automatic candidate exclusion, public-display refusal notes, or changes to entry/exit communication. No new dependency on the unimplemented operational-audit proposal.

## Decisions

### Keep row history outside assignments

Add a state collection such as substitutionRefusals[date][rowKey], holding a list of professor IDs and server-resolved displayed-name snapshots. Deduplicate by professor ID for the note; this is a record of who refused, not a full event journal. Resolve current names when possible, falling back to the snapshot. Existing row identifiers and dates define scope. Keep orphaned history without automatically transferring it if canonical row keys change.

Putting a refused boolean on Assignment would lose context on release or replacement. A separate SQL journal would add a second persistence/restore path for this small operational feature.

### Use an explicit refusal action and one transaction

Extend the assignment mutation contract with a refusal action mutually exclusive with assignment creation and status toggles. The client supplies current row/group preconditions, never the refusing professor's identity or name. The server derives the professor and eligible category from the saved assignment, validates permissions and preconditions inside the write transaction, appends history and removes the assignment. Run the existing save_state path so recovery availability, statistics and paid totals follow the actual remaining assignments.

For campus_notice refusal, derive the current group, check the group fingerprint/token and all affected row permissions, then release and record every member atomically. Extend the group concurrency token if necessary to cover all member assignments, including category/identity metadata beyond message content; the existing notice token alone must not hide a changed member assignment. Include refusal history in relevant row preconditions so simultaneous history edits cannot overwrite one another. Stale retries reject through the existing conflict response; they never operate on a new replacement.

### Render notes independently of assignment controls

Add Rifiutata as an action button, not a persistent toggle: clicking it releases the assignment. Share busy/campus protection and authoritative refresh/error handling with existing mutations. Render history below the substitution selector even when the row has no assignment. Use small red text with explicit wording such as “Ha già rifiutato: Rossi, Bianchi”; meaning must remain understandable without color. Clear obsolete accepted/communicated controls on refresh after refusal. Keep notes internal to the operational table.

Deliberate reassignment remains possible through existing eligibility checks and starts with fresh statuses. Preserve the earlier refusal note without claiming that the new assignment is itself refused.

### Version portable archives explicitly

Introduce schema 12 for exports containing the new state collection; support existing schema 1–11 imports with empty history. Validate dates, row-key shape and bounded, nonempty professor identities/name snapshots independently of whether a row currently exists; reject duplicate/malformed records. Update every applicable schema branch, frontend import contract and archive validation test. Older application versions must reject schema 12 rather than silently discard history.

## Risks / Trade-offs

- Group refusal releases multiple hours → label/title makes whole-notice scope explicit and cover two-row behavior in tests.
- Canonical row identity changes can leave history invisible → retain original records without guessing a new target; document this existing row-identity limitation.
- Reassigning a former refuser leaves a historical warning visible → use past-tense wording; history does not alter the new assignment's status.
- Old binaries cannot read new portable archives → bump schema and retain operational database snapshots; avoid silent history loss during rollback.
- Concurrent campus edits could remove a replacement → validate the complete group and member assignment context inside one transaction.

## Migration Plan

1. Default missing history to an empty collection on normal load; do not backfill or change existing operational assignments. Add validation and schema-12 support with legacy import coverage.
2. Verify API, accounting, concurrency, archive round trips and UI behavior using temporary isolated databases. Rebuild/recreate only a uniquely named compose.testing.yaml project; inspect its mount/port, verify testing=true and the red TESTING ribbon before behavioral changes.
3. Stop only that test project after verification. Deploy with ./scripts/deploy.sh and verify the deployed release/mount through read-only checks; do not create production refusals for verification.
4. On failure, use the deployment snapshot/release procedure. Preserve the new history data and snapshot before rollback; never restore test data or use an older schema-11 export as a lossless backup of schema-12 history. Ask before any commit.
