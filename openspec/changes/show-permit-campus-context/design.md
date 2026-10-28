# Design

## Context

See proposal.md for motivation. Dated permits use day/teacher maps with parallel metadata maps in backend/storage.py. backend/main.py handles creation, moves, deletion and archive validation; backend/concurrency.py hashes related metadata. The authenticated account already exposes its campus. No creator metadata currently exists.

The Permessi component in frontend/src/main.tsx already receives timetable versions and resolves the dataset effective on each permit date. frontend/src/style.css defines campus-centrale and campus-succursale colour tokens. Per-permit remaining hours are available in recovery summaries; teacher balances aggregate several permits and cannot determine whether an individual row is complete.

## Goals / Non-Goals

**Goals:** Follow existing metadata and table patterns with additive, legacy-compatible persistence.

**Non-Goals:** An account audit trail, editor history, creator-based authorization, changes to recovery calculation, and changes to the separate manual-balance table.

## Decisions

- Add a permitCreators day/teacher map containing only centrale or succursale. Read the value from request.state.account on genuine creation. Preserve the original value, including absence of metadata, on edits and moves; remove it on deletion. This follows existing permitKinds/permitNotes handling rather than introducing a new table or storing mutable account names. The UI identifies the office, as agreed, rather than an individual account.
- Include this map in initialization, GET /api/permessi, content preconditions, archive export/import and validation. Legacy missing maps default to empty without attributing old permits to the current editor. Archive metadata is validated for campus values and matching permits; ordinary permit writes cannot choose provenance.
- Derive teaching campuses in the frontend from lessons across the whole weekly dataset returned by permitDataset(date), collecting known lesson sites for that teacher. Do not store a second copy or derive it from permit hours, absences, assignments, or the logged-in office. Unknown sites do not imply a campus; an empty set displays an unspecified dash. This uses the existing lesson site representation rather than inferring a home campus from office-duty activity codes.
- Order table columns as Docente, Sede lezioni, Inserito da, Data permesso, Data richiesta, Ore di permesso, Dettaglio recuperi, Ore da recuperare, Azioni. Reuse campus colour variables and compact C/S tags with full accessible names and hover titles. Unknown provenance displays an unspecified dash.
- Style completed dated rows using each record's recovery.remaining === 0, with the existing fallback to recorded periods when no summary exists. Apply strike-through to data content, excluding action controls and attachment controls. Keep text readable in both themes. Removing deadline and recovered-count cells does not change their backend calculation or the Scadute indication.

## Risks / Trade-offs

- Historical creator information is unavailable → Leave it unspecified permanently, even after an edit.
- Timetable corrections can change derived campus labels → Resolve the version effective on the permit date; do not claim the labels are an immutable historical snapshot.
- Generic archive/state loops can omit or misvalidate new metadata → Cover legacy import, invalid references and round trips in focused regression tests.
- Whole-row decoration can affect buttons → Target data text and verify controls remain legible and usable.

## Migration Plan

No operational record rewrite is needed; loading missing metadata initializes an empty map. Verify backend behavior on temporary databases, build the frontend and inspect the UI only in an isolated compose.testing.yaml project, following AGENTS.md and tearing down that project afterward. Deployment is a separate user-authorized action through scripts/deploy.sh. A rollback should retain a compatible database snapshot containing any newly captured provenance; do not rewrite operational data as part of rollback.
