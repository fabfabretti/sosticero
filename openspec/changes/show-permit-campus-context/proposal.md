# Proposal

## Why

The permit register does not show which office entered a permit or where the teacher teaches. These details help offices coordinate future recovery; removing redundant numeric and deadline columns makes room for them.

## What Changes

- Add Inserito da, automatically recording the creating account's campus and preserving it through edits; older records remain unspecified.
- Add Sede lezioni, showing campuses across the whole weekly timetable effective on the permit date.
- Reuse existing campus colours for accessible tags; C/S abbreviations are allowed when space is tight, with both tags for teachers teaching at both campuses.
- Remove Scadenza recupero and Ore recuperate columns while preserving recovery rules and details.
- Strike through fully recovered dated permit records when their individual Ore da recuperare is zero, keeping actions usable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `permessi`: creator-campus provenance, weekly teaching-campus display, and a more compact register with completed records struck through.

## Impact

- Backend permit persistence, authenticated creation, GET response, archive validation/portability and concurrency metadata.
- Frontend Permessi table, types and styles; existing timetable versions and campus colour tokens are reused.
- Focused backend regression tests and isolated UI verification. No new dependencies, permission changes or production data edits.
