# Design

## Context

See proposal.md for motivation. State is stored as JSON documents in SQLite. Separate date/teacher maps already hold absenceKinds, permitKinds and permitRequests. The current compact-absence-entry work provides ⋯ controls on manual rows; HourHelp already supports hover, focus and fixed positioning outside sidebar overflow. Permit edits support original source references and stable identities. Archive import explicitly validates state groups. This change spans storage, API and UI, warranting a short design.

## Goals / Non-Goals

**Goals:** Reuse existing metadata and tooltip patterns while keeping source ownership clear and edits independent.

**Non-Goals:** Rich text, note histories, per-hour notes, class/availability notes, undated manual recovery debt notes, new dependencies or changes to ranking and recovery rules.

## Decisions

### Separate source metadata

Add absenceNotes and permitNotes maps keyed by date/teacher, storing nonempty strings. A shared note was rejected because both sources can coexist and be removed independently. Extend state defaults/load normalization and response types; no SQLite table migration is needed. Add strict string-or-null note fields to entry and permit payloads. Missing fields preserve notes; explicit null or trimmed-empty strings clear them. Trim outer whitespace and retain internal text. Reject note input on class/availability entries.

### Preserve lifecycle atomically

Use field-presence tracking like classifications. Hour changes preserve omitted notes; deleting a source removes its metadata. Resolve permit notes from the original source before valid moves, clear old metadata and attach the note to the destination within the existing transaction. Recovery protection still runs; rejected mutations leave all metadata intact. Archive validation checks string types and valid source references without reapplying current timetable limits to historical records. Missing maps normalize to empty; no archive version bump is needed. Updated-app backward import is supported; older apps are not guaranteed to retain new metadata.

### Explicit save for note edits

Extend the existing manual row editor with a labelled Note text field and explicit save action. Keep a local draft so typing does not trigger network writes; clear/reload drafts when changing date or source. Classification controls retain their existing behavior. Add a labelled optional Note field to the dated Permessi form and submit with the existing save operation. Load notes when editing and reset the draft after success/cancel to avoid carrying personal context into another record. A failed save retains the draft for correction.

### One combined tooltip

Compose current permit information plus labelled Assenza and Permesso note sections. Use the existing HourHelp trigger once per row, including permit-only rows. Preserve focus accessibility and escaped React text rendering. Add whitespace handling and wrapping for long strings; constrain tooltip size and provide scrollable overflow for unusually long notes. No arbitrary text length cap is introduced in this first version. A separate tooltip per source was rejected to keep rows compact.

## Risks / Trade-offs

- Omitted fields accidentally clearing notes → explicit field-presence handling and preservation tests.
- Moves/deletes leave orphan metadata → source-aware transactional cleanup and archive validation tests.
- Long notes make the tooltip unwieldy → viewport constraints, wrapping and accessible scrolling.
- Overlap with uncommitted compact entry work → build on the current tree, preserve unrelated edits and leave its planning artifacts untouched.

## Migration Plan

1. Verify backend and UI behavior against isolated temporary databases; cover legacy normalization and archive round trips.
2. Build and force-recreate with an explicitly selected temporary Compose override replacing the entire /data mount; supply LOCAL_UID and LOCAL_GID and verify the mount before any writes. Use SQLite online backup if realistic data is needed.
3. Restore normal deployment using LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate. Verify the project data mount and current frontend asset hash with read-only checks.
4. Rollback may use previous application code, but note retention through older edit/import paths is not guaranteed; retain a backup before rollback. Never copy test state back into operational data.
