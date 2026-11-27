# Proposal

## Why

Staff cannot correct ordinary teaching hours or create and remove hours when a teacher's real timetable changes. This forces corrections outside the application even though dated timetable overrides already support limited edits.

## What Changes

- Allow staff to create, edit, move, swap and remove hours for all teachers, including curricular, ITP and support lessons, within the existing dated override workflow.
- Edit an hour's kind, class and campus; allow substitution-available activities such as POT with or without a class, retain the existing per-hour POT enable/disable control, and leave other types to administrative availability settings.
- Use the edited hour consistently in Sostituzioni and other dated consumers, preserving saved assignments and warning about impacts and independent overlapping commitments.
- Preserve imported schedules, existing multi-class data, override lifecycle, import conflict review and archive compatibility.
- Reuse existing Orari controls, dialogs, styling, accessibility and interaction patterns so the editor feels coherent with the application.

## Capabilities

### New Capabilities

- `timetable-hour-editing`: Full dated editing of individual teacher timetable hours and their operational effects.

### Modified Capabilities

None. The existing timetable override capabilities are defined in completed, unarchived changes; this capability supersedes their restrictions on fixed lessons, conserved hour counts and activity conversion.

## Impact

Orari's teacher timetable editor, override validation and reconciliation, dated schedule consumers, import compatibility, archives and focused backend/frontend tests. No new external dependencies are anticipated.
