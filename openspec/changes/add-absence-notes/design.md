# Design

## Context

See proposal.md for motivation. State is stored as JSON documents in SQLite. Separate date/teacher maps already hold absenceKinds, permitKinds and permitRequests. The current compact-absence-entry work provides ⋯ controls on manual rows; HourHelp already supports hover, focus and fixed positioning outside sidebar overflow. Permit edits support original source references and stable identities. Archive import explicitly validates state groups. The original notes implementation is committed: manual absence notes are editable only after creation, dated permit forms already include Note, and neither permit table exposes notes. Undated balance records currently allow exactly id and hours in recovery validation. This change spans storage, API and UI, warranting a short design.

## Goals / Non-Goals

**Goals:** Reuse existing metadata and tooltip patterns while keeping source ownership clear and edits independent.

**Non-Goals:** Rich text, note histories, per-hour notes, class/availability notes, new dependencies or changes to ranking and recovery rules.

## Decisions

### Separate source metadata

Add absenceNotes and permitNotes maps keyed by date/teacher, storing nonempty strings. A shared note was rejected because both sources can coexist and be removed independently. Extend state defaults/load normalization and response types; no SQLite table migration is needed. Add strict string-or-null note fields to entry and permit payloads. Missing fields preserve notes; explicit null or trimmed-empty strings clear them. Trim outer whitespace and retain internal text. Reject note input on class/availability entries.

### Undated balance note metadata

Add a manualPermitNotes map keyed by teacher, matching the single manual balance per teacher. Keep notes separate from the id/hours record to preserve the recovery ledger's strict record shape. Extending each balance record was considered but would unnecessarily couple display metadata to recovery accounting. Add a strict optional note field to ManualPermit; omitted values preserve, null/trimmed-empty values clear. Validate references against manualPermits during archive import, including string types and nonblank stored values. Missing maps mean no notes. Delete metadata with the balance and preserve it on hour edits and rejected recovery-protected changes. Expose the map explicitly in the Permessi response rather than relying on ledger projections to retain it. Backup/export/import must retain it.

### Preserve lifecycle atomically

Use field-presence tracking like classifications. Hour changes preserve omitted notes; deleting a source removes its metadata. Resolve permit notes from the original source before valid moves, clear old metadata and attach the note to the destination within the existing transaction. Recovery protection still runs; rejected mutations leave all metadata intact. Archive validation checks string types and valid source references without reapplying current timetable limits to historical records. Missing maps normalize to empty; no archive version bump is needed. Updated-app backward import is supported; older apps are not guaranteed to retain new metadata.

### Explicit save for note edits

Extend the existing manual row editor with a labelled Note text field and explicit save action. Keep a local draft so typing does not trigger network writes; clear/reload drafts when changing date or source. Classification controls retain their existing behavior. Add a labelled optional Note field to the Supplenze add-teacher form, shown only for manual teacher absences and included in the initial entries request. Retain the existing dated Permessi Note field and show the same field for undated manual balances, submitting to the appropriate endpoint. The reported missing dated field must be checked in a freshly served build, for creation before teacher selection, after selection and while editing; diagnose any visibility/layout regression rather than adding a duplicate field. Load notes when editing and reset the draft after success/cancel to avoid carrying personal context into another record. A failed save retains the draft for correction. Clear the Supplenze creation note after a successful add and date/source switches so it cannot be attached to the next teacher accidentally; keep other existing option-retention behavior. Keep creation and saved-row editor drafts separate. Switching between dated permits and manual balances resets note drafts through the existing form reset.

### One combined tooltip

Compose current permit information plus labelled Assenza and Permesso note sections. Use the existing HourHelp trigger once per row, including permit-only rows. Preserve focus accessibility and escaped React text rendering. Add whitespace handling and wrapping for long strings; constrain tooltip size and provide scrollable overflow for unusually long notes. No arbitrary text length cap is introduced in this first version. A separate tooltip per source was rejected to keep rows compact.

### Compact tables with note indicators

Reuse HourHelp for a single note (i) adjacent to the teacher name in each dated permit and manual balance row. Omit that icon for blank notes; keep unscheduled-hour warning indicators separate. Notes stay outside table cell text, so long notes do not enlarge rows. Preserve wrapping, plain-text rendering, keyboard access and viewport constraints from the daily tooltip.

Scope density styles to Permessi tables. Reduce cell padding and period gaps, remove the unconditional warning-height reservation on rows without warnings, and place warning icons inline with periods. Use compact icon actions with accessible names instead of a wide Modifica label in manual balances. Preserve all existing columns, sorting indicators, balances, expiry markers and full recovery details, allowing row height to grow for real multiline content. Keep current readable font sizes and visible focus; horizontal scrolling remains available on small screens. Hiding columns or truncating recovery history was rejected because density should not remove information.

## Risks / Trade-offs

- Omitted fields accidentally clearing notes → explicit field-presence handling and preservation tests.
- Moves/deletes leave orphan metadata → source-aware transactional cleanup and archive validation tests.
- Long notes make the tooltip unwieldy → viewport constraints, wrapping and accessible scrolling.
- Overlap with uncommitted compact entry work → build on the current tree, preserve unrelated edits and leave its planning artifacts untouched.

## Migration Plan

1. Run backend and frontend checks with temporary databases, including legacy archives, manual balance metadata, all creation flows and both tables.
2. Use standalone compose.testing.yaml with a unique TEST_PROJECT, a fresh TEST_DATA_DIR and the automatically allocated localhost port. Supply LOCAL_UID/LOCAL_GID, build and force-recreate that test project, and verify its /data mount, /api/environment testing:true response and TESTING ribbon before behavioral checks. Normal service stays running untouched.
3. Verify creation/editing and (i) tooltips for dated permits, manual balances and Supplenze on desktop and narrow screens. Compare representative table rows before/after for density, warning visibility and complete recovery details. Stop only this test project afterward.
4. Deploy approved implementation with LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate. Read-only checks must confirm the operational data mount, testing:false and the newly served asset hash. Never copy test state to operational data.
5. Older code may discard optional note metadata through edits/import. Retain a backup before rollback; no destructive migration is required.
