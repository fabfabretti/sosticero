# Proposal

## Why

Staff need to correct the displayed teacher name without changing teacher identity or existing operational records. A current name override is sufficient; the previously proposed replacement prototype is superseded by this change and is not to be implemented.

## What Changes

- Add set/edit/remove name overrides to Orari, preserving imported names and stable IDs.
- Store an explicit current name and original-professor label, avoiding automatic interpretation of mixed imported names.
- Show the imported name struck through beside the new label in Orari; use `Current (Original)` in selectors, Supplenze and teacher-name outputs, with search for both names.
- Match pending Inbox submissions against imported, current and original names, requiring manual selection when more than one teacher ID matches.
- Preserve overrides through imports, backups and validated archive round trips.
- Defer separate permessi and recovery accounting. Overrides are labels on the same account and change no balances or ownership.

## Capabilities

### New Capabilities

- `teacher-name-overrides`: Manage a current presentation override independently of imported teacher identity and operational state.

### Modified Capabilities

- `absence-inbox`: Resolve explicit teacher-name aliases to one existing teacher ID while retaining ambiguity review.

## Impact

Orari controls, shared teacher presentation, Inbox name resolution, a separate document in the existing SQLite store, and archive compatibility. No new dependencies or replacement scheduling model. Imports and scheduling datasets remain immutable; existing IDs, records, assignment links, eligibility, statistics and accounting retain their meaning. This is a current global presentation preference, without effective dates: historical screens also use the current label. Removal restores imported presentation. Verification uses temporary databases and the standalone testing deployment, leaving normal service untouched.
