# Proposal

## Why

Permessi rebuilds and transfers complete historical timetables to answer a small set of scheduling questions. Orari mounts every teacher grid together, which can delay usable content and block interaction. Production timing is not yet measured; the change will measure improvements on isolated representative data.

## What Changes

- Keep Permessi's UI, single-load interaction and functionality unchanged, replacing full historical datasets with compact date-effective teacher, scheduled-hour and site information.
- Reduce redundant timetable reconstruction within the permit read while preserving the authoritative date-effective rules.
- Render Orari grids progressively, yielding between batches and showing a loader at the end until every matching teacher is rendered.
- Preserve complete search, saved timetable editing, refresh behavior and full PDF export.
- Measure request preparation, response size and first usable content before and after. Leave shared polling/revision redesign outside this change.

## Capabilities

### New Capabilities

- `teacher-timetable-rendering`: Progressive delivery of usable Orari grids, complete search and uninterrupted interaction during rendering.

### Modified Capabilities

None. Permessi's payload optimization preserves existing behavior and requirements; its equivalence checks belong in design and tasks.

## Impact

Backend permit response construction in `backend/main.py` and date-effective projection helpers; frontend Permessi consumers in `frontend/src/main.tsx`; progressive mounting in `frontend/src/TeacherTimetables.tsx`; focused backend/frontend tests. No database migration, operational record change, dependency addition or shared refresh redesign. Deploy backend/frontend together after isolated verification using the existing deployment script.
