# Proposal

## Why

Staff need to adjust frequently changing special hours without replacing imported timetables. Orari also needs denser, clearer campus-based styling and explicit visibility of dated manual changes.

## What Changes

- Render compact rounded rectangles with class/activity labels and [C]/[S]: campus outline for ordinary lessons, campus fill for special activities.
- Add per-teacher edit, save, cancel, effective start and optional inclusive end dates, and MODIFICATO status.
- Move special hours into empty cells or swap special hours within a teacher's week; ordinary class lessons remain fixed.
- Toggle special hours into emergency-only availability while retaining hidden-type and hard eligibility restrictions.
- Store dated overlays separately from immutable imported versions. Later overlapping overrides take precedence; expiry resumes the earlier applicable schedule.
- Preserve compatible overrides across imports; preview and flag conflicts, falling back to imported hours for affected edits until reviewed.
- Preserve existing assignments and recovery accounting, flag affected coverage for review, and support dated reset to the imported schedule.

## Capabilities

### New Capabilities

- `timetable-overrides`: Compact Orari presentation, special-hour editing, dated overlay resolution, reset, import reconciliation and persistence. Supersedes the read-only and activity-colour requirements in the completed but unarchived view-teacher-timetables change.

### Modified Capabilities

- `candidate-selection`: Disabled visible special hours require exceptional assignment; hidden types remain hidden.

## Impact

Touches TeacherTimetables, timetable presentation helpers/styles, timetable resolution and import planning, domain eligibility, API validation, statistics reconciliation, archives/backups and their tests. Reuse existing SQLite document storage and exceptional-assignment UI. No production data changes, ordinary lesson editing, cross-teacher moves, or new scheduling solver are included. Existing uncommitted work and other OpenSpec changes must be preserved.
