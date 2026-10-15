# Proposal

## Why

Office staff need to record context for an absence or hourly permit and enter it while creating the record and read it directly from daily Assenze rows and Permessi tables. Existing permit information tooltips provide a compact place to expose this context.

## What Changes

- Add one optional plain-text note per manual teacher absence/date, entered in the Supplenze add-teacher form and editable through the row's existing ⋯ controls.
- Add one optional plain-text note per dated permit and per undated manual balance, entered and edited on the Permessi page. Keep the Note field visible before the initial save in both form modes.
- Show available notes in the Assenze row's shared (i) tooltip, preserving existing permit information and distinguishing Assenza from Permesso notes.
- Show a note (i) beside the teacher in dated Permessi and Saldi manuali table rows when a note exists, accessible by hover and keyboard focus.
- Make both Permessi tables more compact through tighter spacing and inline indicators, retaining all columns, sorting, warnings and recovery details.
- Clear note drafts after successful creation or cancellation and retain them on failed saves.
- Preserve notes across hour edits, reloads, backups and archive round trips; move permit notes with valid permit moves and remove metadata with its source.

## Capabilities

### New Capabilities

- `absence-notes`: Manual absence note creation/editing, combined daily tooltip presentation and note persistence.

### Modified Capabilities

- `permessi`: Dated permit and undated balance notes, table information tooltips, and compact register presentation.

## Impact

Frontend main.tsx, types.ts and tooltip/editor styles; backend entry, dated permit and manual balance payloads, state defaults, lifecycle handling and archive validation; focused backend and sidebar tests. No new dependencies or SQLite tables. Build on the current working tree's compact-absence-entry controls without changing that change's artifacts. Manual balance note storage also touches recovery validation and register responses. Class absences and availability remain outside scope.
