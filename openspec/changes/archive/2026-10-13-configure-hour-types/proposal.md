# Proposal

## Why

Hour activity codes currently have hard-coded eligibility, and importing discards codes other than POT, UTC, UTS and DIS. The office needs to distinguish other-school commitments, adjustable potenziamento hours, and exceptional compresenza candidates through settings shared by all occurrences of a type.

## What Changes

- Add a Settings table listing imported activity codes and derived types, with independent controls for availability, visibility among candidates, and whether the activity is at this school.
- Preserve all activity codes and assign each type a random, readable color once, persisted and reused in candidate badges.
- Apply settings globally by type, including separate Compresenza ITP and Sostegno controls. Show visible occupied candidates as exceptional fallbacks requiring explicit confirmation; hide types whose visibility is off.
- Preserve absence/double-booking restrictions, existing assignments, campus ranking, and class-out availability behavior.
- Persist settings across imports and restarts and include them in portable exports and database backups.
- Record future teacher/date/hour overrides as a deferred TODO; do not implement them here.

## Capabilities

### New Capabilities

- `hour-types`: Type discovery, global policy settings, school semantics, colors, persistence and archive compatibility.

### Modified Capabilities

- `candidate-selection`: Apply type policy and support explicit exceptional assignments while retaining hard restrictions.
- `app-shell`: Replace the outdated Settings-placeholder contract with the functional Settings screen.

## Impact

Backend normalization, eligibility, ranking, assignment validation, settings endpoints and JSON export/import in `backend/domain.py`, `backend/main.py` and `backend/storage.py`; Settings, candidate drawer, shared types and styles in `frontend/src/`; backend and focused frontend tests. SQLite database snapshots already capture stored documents. No new runtime dependency is expected. Older normalized datasets cannot recover discarded codes without reimporting the original timetable.
