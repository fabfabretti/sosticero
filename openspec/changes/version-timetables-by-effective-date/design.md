# Design

## Context

See proposal.md for motivation. Storage uses JSON documents in SQLite. `load` currently returns one dataset for all dates; domain rules already accept datasets explicitly. `/api/day` revalidates saved assignments against that dataset. `statistics.sync` intentionally keeps old absence context and eligibility, so simply selecting another dataset will not reconcile affected facts. State archives currently omit timetables and validate against one teacher inventory. Backup filenames currently have second precision.

## Goals / Non-Goals

Goals: one date resolver shared by every dated operation, recoverable corrections, explicit conflict review, and preservation of unrelated records.

Non-goals: partial timetable merging, temporary overrides, automatic reassignment, timetable editing, version deletion or same-date replacement, and reconstruction of timetables already lost before this upgrade.

## Decisions

### Persist immutable versions in the existing document store

Use a schema-tagged timetable history document with stable version IDs, a baseline and sorted dated full normalized datasets. Baseline covers dates before the first dated version. Reject duplicate effective dates rather than building replacement/deletion flows. Inserting a backdated version changes only its interval up to the next existing version. Full copies are small and clearer than lesson-level deltas. Preserve immutable teacher metadata per version and historical identity lookup; a teacher absent from a selected version is inactive for new choices but remains addressable in saved records.

### Resolve datasets at the date boundary

Reuse pure domain functions with an explicitly resolved dataset. Audit day loading, candidates, entries over date ranges, permit edits/moves, assignments, default/automatic availability, statistics reconstruction, archive validation and startup migrations. Resolve independently for each date, including both source and destination of moved records. Undated permit/recovery screens need the union identity catalog with current active status, rather than borrowing a future dataset. Persisted recovery accounting remains independent of timetable eligibility.

### Preview and apply the same deterministic plan

Extend the timetable API with a read-only preview and a confirmed apply carrying the unchanged JSON, effective date and preview fingerprint. Hash normalized input, date and relevant stored documents using standard library hashing; a changed input, timetable, settings, facts or state invalidates confirmation. Preview reports interval, affected dates, lesson/demand differences, assignments and ID additions/removals. The app defaults the date in Europe/Rome, warns about historical corrections and possible ID renumbering, and shows a final explicit confirmation. Do not automatically match names or transfer records between IDs. A complete school file is the documented contract; the app cannot prove omissions are accidental, so preview removals prominently.

### Preserve conflicts as evidence, not hidden dictionary entries

Before reconciliation, capture original assignment context from the applicable old timetable and saved facts. Store minimal context keyed by date and assignment identity for unresolved records, including references to old/new version IDs. Display orphan assignments outside the live row table with actions to remove explicitly or select a current demand and save a replacement through normal validation. Preserve valid assignments unchanged; no import-time reassignment. Preserve absences, notes, classifications, availability, exclusions and permit IDs even when references are no longer active. Report inconsistent references rather than stripping them. Explicit removal/replacement of RP assignments uses existing recovery protection and updates links/accounting atomically.

### Separate timetable correction from ordinary statistics synchronization

Keep existing snapshot semantics for unchanged dates and ordinary operational edits. Add an explicit interval reconciliation path using per-date versions: rebuild affected lesson context and demand, re-evaluate coverage eligibility, and disclose orphan assignments. Retain pre-correction facts and affected assignment context in a correction record tied to the version, so original evidence survives beyond backup retention. Do not count unresolved cover as valid or silently change recovery balances. Ordinary calls must not restore stale pre-correction context. This extends the durable-facts requirements in the unarchived stats change; coordinate before applying or archiving either change.

### Back up and commit under a guarded snapshot

Use the existing SQLite online backup facility, extending it for collision-safe filenames and verification. Acquire a write reservation, recheck the preview fingerprint, then back up the committed pre-import state using a separate read connection while writes remain blocked. Do not invoke backup on the same connection holding an active write transaction; test this locking path explicitly. Verify snapshot integrity and complete the version, evidence, facts and policy updates in that guarded transaction. Failure rolls back application; a successfully created pre-import backup can remain after a later failure. Preserve existing production confirmation and testing-mode protections.

### Version archives explicitly

Introduce the next archive schema carrying the full timeline and correction/conflict evidence alongside existing state, policies and facts. Validate all cross-references and select the correct dataset per dated record before committing. Continue accepting legacy schemas against the existing timeline; they do not replace or fabricate versions. If legacy statistical context is unavailable, retain reconstructed provenance and disclose limitations. Database backups naturally include all new documents. Reject malformed or incompatible archives atomically.

## Risks / Trade-offs

- Historical timetables overwritten before migration cannot be recovered from the current dataset: disclose baseline limits; do not manufacture history.
- Teacher ID renumbering can look like departures and arrivals: surface inventory differences and require reviewed confirmation; never infer identity from names.
- Stored class/teacher references may disappear: retain identity/context and expose unresolved records in daily views and archive round trips.
- Statistics and recovery measure different things: flag invalid RP coverage while preserving ledger entries until explicit correction.
- Backup and reconciliation hold a write reservation: keep preview outside the transaction, check realistic school-sized data and fail cleanly on lock timeout.
- Other active changes touch entries/statistics: integrate their final record shape rather than discarding unknown operational fields.

## Migration Plan

1. Test on a new temporary database and, if needed, an online-backup copy of operational data. Never copy a live SQLite file directly.
2. Create baseline history atomically and idempotently during explicit app initialization. Preserve legacy dataset, state and facts; imports remain side-effect free.
3. Validate date boundaries, backdated insertion, conflict evidence, archive round trips and backup/restore before deployment. Compare untouched records and dates for exact preservation.
4. Use only the isolated standalone testing Compose project and random localhost port; inspect mount and `/api/environment` and the TESTING ribbon before behavioral mutations. Stop only that project.
5. Deploy only when approved, rebuilding and recreating normal Compose against the project data directory. Check mount and served asset hash read-only. Roll back using compatible code plus a verified full backup if the storage schema requires it; restoration of production data needs explicit authorization.
