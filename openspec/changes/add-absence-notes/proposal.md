# Proposal

## Why

Office staff need to record context for an absence or hourly permit and read it directly from the daily Assenze row. Existing permit information tooltips provide a compact place to expose this context.

## What Changes

- Add one optional plain-text note per manual teacher absence/date, editable through the row's existing ⋯ controls.
- Add one optional plain-text note per dated permit, entered and edited on the Permessi page.
- Show available notes in the Assenze row's shared (i) tooltip, preserving existing permit information and distinguishing Assenza from Permesso notes.
- Preserve notes across hour edits, reloads, backups and archive round trips; move permit notes with valid permit moves and remove metadata with its source.

## Capabilities

### New Capabilities

- `absence-notes`: Manual absence note editing, combined daily tooltip presentation and note persistence.

### Modified Capabilities

- `permessi`: Optional notes managed from the permit form and exposed in daily absence information.

## Impact

Frontend main.tsx, types.ts and tooltip/editor styles; backend entry and permit payloads, state defaults, lifecycle handling and archive validation; focused backend and sidebar tests. No new dependencies or SQLite tables. Build on the current working tree's compact-absence-entry controls without changing that change's artifacts. Undated manual recovery debts, class absences and availability are outside scope.
