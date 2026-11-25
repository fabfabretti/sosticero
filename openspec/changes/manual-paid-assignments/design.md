# Design

## Context

See proposal.md. The manual dialog sends category MANUAL with explicit exceptional confirmation; the server accepts active teachers and retains an optional note. Paid records use category PAID, server-generated attribution, context and price, and are counted directly from assignments. Ordinary paid validation requires a declaration and additional eligibility checks. Existing paid metadata, reporting and actions depend on PAID.

## Goals / Non-Goals

**Goals:** Reuse the paid ledger while preserving the deliberately broader manual exception path, including reload, review and archive handling.

**Non-Goals:** Change automatic candidate ranking, declare recurring availability, or alter ordinary paid candidate eligibility.

## Decisions

- Persist manual paid work as PAID with a validated manual-origin marker. This lets existing reports, pricing and paid actions operate on one ledger while allowing saved-assignment revalidation and editing to retain manual semantics. A separate category would require duplicating all paid consumers. Keep the marker distinct from the exceptional flag, which ordinary paid assignments already use.
- Require an explicit manual-paid request and the existing exceptional confirmation; validate it through the manual path before adding normal paid metadata in the same transaction. Do not let an ordinary PAID request bypass declaration or other restrictions. Keep campus authorization, concurrency checks and inactive-teacher restrictions intact.
- Default new dialog choices to free; reopen existing manual assignments with their saved payment choice and note. Preserve paid metadata on unchanged saves; when payment category changes, follow existing replacement behavior and initialize or remove paid metadata as appropriate. Preserve normal paid assignments and their edit behavior.
- Accept the optional note on manual paid records and carry the marker and note through validation, review, archive export/import and backups. Existing records require no migration: missing marker means ordinary paid; legacy MANUAL remains free.

## Risks / Trade-offs

- Manual assignments can override scheduling conflicts, including absence or double booking → keep the existing visible warnings and explicit assignment, and limit the bypass to the manual request.
- Saved manual paid assignments could be misclassified or lose metadata during revalidation → cover reload, timetable review, archive round-trip and metadata updates with focused tests.
- Rolling back to an older release could mishandle the new marker or manual paid revalidation → retain the deployment snapshot and verify rollback compatibility before restoring an older release; do not discard operational records.

## Migration Plan

No data rewrite is planned. Deploy using the standard server deployment script and its snapshot; verify the release with read-only checks. Behavioral verification uses only an isolated testing database. Restore from the deployment snapshot if rollback requires reverting data, subject to preserving subsequent operational changes.
