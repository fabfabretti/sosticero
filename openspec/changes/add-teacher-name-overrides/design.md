# Design

## Context

The existing SQLite document store supports additive settings without schema-table changes. Scheduling and accounting use stable teacher IDs. Imported timetable datasets and correction evidence have strict validators; changing their names would introduce unnecessary historical and import coupling. Inbox currently compares the submitted name exactly against teacher names. See proposal.md for the agreed limited scope; it supersedes the unimplemented replacement experiment.

## Goals / Non-Goals

**Goals:** One current presentation override, reversible from Orari; consistent labels and alias matching; operational state preserved exactly.

**Non-Goals:** Dated appointments, new teacher identities, schedule inheritance, automated parsing of parentheses, migration of existing records, separate accounting or historical name reconstruction.

## Decisions

### Keep presentation separate from imported and operational data

Use one schema-tagged `teacherNameOverrides` document keyed by existing teacher ID, with `name` and `originalName` fields. Missing document means no overrides. Validate against the union of imported teacher IDs; trim fields, reject blanks/control characters and excessive length using an explicit shared bound. Store only on explicit edits. Never rewrite imported datasets, state, statistics, correction evidence or timetable patches.

Apply labels in response copies at a presentation boundary, preserving the imported name as separate response metadata. Audit candidates (which contain their own name), Orari, Inbox, Permessi, import-preview labels, historical/conflict displays and PDF projection. Do not feed decorated names back into timetable digests, validators or evidence persistence. Use shared formatting/search helpers rather than screen-specific substitutions. Existing saved conflict evidence remains authoritative and unchanged.

### A simple editor with two explicit names

Orari exposes current name and original professor plus Save/Cancel/Remove. Show the immutable imported label for context and struck through when overridden; display the effective label beside it. Do not gate the action on parentheses. Existing parenthesized labels can highlight likely cases, but never infer ownership from their order. Show a concise explanation that permits and recovery remain on the same account. No appointment/date controls.

Confirmed examples, for documentation and isolated fixtures only; no automatic production initialization:

| ID | Current name | Original professor |
| --- | --- | --- |
| d015 | Gamb.tto Silvia | Benedetti |
| d036 | Binotto Steven | Cavallaro |
| d085 | Lazzaro Vinc | Lavorato |
| d134 | Spillari Davide | Savelli |

### Save atomically without scheduling reconciliation

Use existing API validation/error conventions and a transaction. Update only the target entry in the document; reject a stale edit using the previous target value supplied by the client, so one user's correction cannot silently overwrite another's. Removing an absent record may be idempotent. These operations need no timetable impact preview or statistics rebuild because they do not change eligibility or identity.

### Match aliases conservatively within existing identity semantics

Inbox compares normalized imported, override, original and formatted names, collecting all matches before deciding. Normalize case and whitespace only; no fuzzy surname matching or automatic parenthesis parsing. Multiple aliases for one ID count once; multiple IDs remain ambiguous. Removing an override removes its extra aliases from future matching. Accepted items retain their stored ID and are never reapplied. No new account ownership interpretation is introduced.

### Preserve portable data without touching imported history

Extend the next supported JSON archive schema to carry the override document and validate it before writes. Older archives keep current overrides if references remain in restored history; otherwise fail atomically with an explanation, allowing the user to resolve overrides explicitly. New archives restore their explicit override document, including empty. Timetable imports preserve entries by ID and retain missing IDs dormant; no name-based remapping. Database backups already capture the document. Do not run older code against the new portable format and assume it preserves names.

## Risks / Trade-offs

- Names currently also describe shared accounting -> explain the limitation in the editor; preserve ledger behavior and add preservation tests.
- Current labels change historical presentation -> document this intentional global preference; saved historical evidence is not rewritten.
- Raw imported names and candidate payload names can bypass UI helpers -> audit all name response paths and PDF projection once, with focused regression coverage.
- Reused imported IDs could attach an override to the wrong person -> preserve the app's existing stable-ID import contract, show imported identity in Orari, never infer remapping.
- Unrelated uncommitted work shares affected files -> preserve it and verify against the actual current baseline; no reset or commit without permission.

## Deferred Work

Separate permits, manual balances and RP debt for original and replacement teachers require a future explicitly scoped change. This feature creates no second person or account and must not be used as evidence that such accounting is separated.

## Migration Plan

No operational records need migration; absent override document is empty. Test fresh and legacy archives, same-ID imports, missing teachers, name collisions and save/edit/remove against temporary databases. Compare state, statistics, permit IDs, RP links and balances before and after name changes. Build/recreate only a unique standalone `compose.testing.yaml` project, inspecting the temporary mount, allocated port, testing endpoint and ribbon before behavioral changes; verify Orari, selection, Inbox and PDF, then stop that test project. Normal service remains untouched during testing. Any later approved deployment uses the normal project data mount and read-only deployment verification.
