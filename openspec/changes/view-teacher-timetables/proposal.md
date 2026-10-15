# Proposal

## Why

The office can import and version the weekly timetable, but there is no way to
*look at it*. Every screen consumes the timetable indirectly: Supplenze shows
only the rows that need covering today, and Permessi uses lessons only to warn
about unscheduled permit hours. Staff who want to answer "what does this teacher
teach, and when, and with whom" have to read the original Untis PDFs.

The same imported data already answers that question. This change adds a
reference screen that renders each teacher's weekly timetable as a grid, so the
timetable becomes visible and searchable inside the app.

## What Changes

- Add an **Orari** screen showing the current timetable as one weekly grid per
  teacher (days as columns, hours as rows), with one or two grids per row.
- Each cell shows the class, the co-teachers when the hour is a compresenza
  (inline names), or the activity code (POT, DI.S, UTC, …) tinted with the color
  already configured for that type in Settings.
- Add a filter by teacher name or code; all active teachers are shown by
  default (no minimum query length).
- Add a small read-only endpoint that returns the timetable version currently in
  effect, so the screen never has to fetch every historical version.
- Show the effective date of the rendered version.

Out of scope (deliberately, for now):

- Manual overrides (enable/disable/move hours) — the screen is read-only
  reference.
- Resolving the articolazioni / room-conflict ambiguity in compresenza
  detection; the initial rule is "more than one teacher in the same class and
  hour".

## Capabilities

### New Capabilities
- `teacher-timetables`: rendering the current timetable per teacher, deriving
  compresenza from shared class/hour, presenting activities with their configured
  colors, and filtering by teacher.

### Modified Capabilities
- `app-shell`: the tab bar gains an Orari tab and the Orari screen is functional
  rather than a placeholder.

## Impact

- `frontend/src/main.tsx`: new tab entry, route, and screen wiring in `TABS`,
  `screenFor` and `Shell`.
- `frontend/src/`: new screen component and a pure timetable-grid helper.
- `frontend/src/style.css`: styles for the grid and activity tints.
- `backend/main.py`: new read-only `GET` endpoint returning the active version.
- `frontend/tests/`, `backend/tests/`: tests for the helper, the screen and the
  endpoint.
- Existing behavior is unchanged: this is additive.
