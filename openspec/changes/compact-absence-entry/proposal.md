# Proposal

## Why

Adding an absent or available teacher currently saves immediately when a suggestion is clicked, before the user can comfortably review options. Absences and permits also lack an explicit optional distinction between planned and last-minute events.

## What Changes

- Select a search suggestion without saving; add with an explicit Aggiungi button or Enter using the selected/highlighted suggestion.
- Replace Alcune ore with Tutto il giorno, initially on; show inline hour selection when off.
- Keep A disposizione as a visible on/off toggle and retain current form options after adding a teacher.
- Remove the Più giorni control from this form.
- Add optional mutually exclusive Programmata and Last minute choices for manual teacher absences and for permit entry/editing, without backfilling existing records.
- Group the sidebar into Assenze programmate, Assenze non classificate, and Assenze last minute, followed by A disposizione. Each teacher appears once with all absent hours; any last-minute source takes precedence.
- Keep entry controls compact and reveal conditional fields only when needed. No LM/P sidebar badges.

## Capabilities

### New Capabilities

- `absence-entry`: Compact daily entry, optional manual absence classification, and grouped teacher absence lists.

### Modified Capabilities

- `permessi`: Optional planned/last-minute classification on permit entry and editing, preserved through storage and archive operations.

## Impact

Frontend Supplenze and Permessi in main.tsx, shared types and styles, and sidebar browser tests. Backend entry/permit models and handlers, state normalization, archive validation and associated tests. Optional classification metadata extends existing state without changing absence-hour calculations, substitution ranking, recovery accounting or statistics. No new dependencies. Existing uncommitted implementation changes must be preserved.
