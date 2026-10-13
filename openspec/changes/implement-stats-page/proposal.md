# Proposal

## Why

The Stats tab is a placeholder, leaving the office without evidence of substitution workload and its consequences. A credible report for the dirigente must distinguish staff absence, class cover demand, and outcomes while preserving historical facts when timetables change.

## What Changes

- Implement Stats with Centrale, Succursale and Totale filters and All, This week, This month and Custom periods.
- Show absent teachers, absent teacher-periods and class periods requiring cover, leading with class cover demand; provide daily, weekday, period and weekday-by-period views.
- Average over days with recorded absences, excluding blank days and using the same dates across campuses.
- Add an explicit Uncovered outcome in Supplenze, separate from pending decisions and late entry/early exit.
- Save dated absence and class-period facts, including campus and outcome, so historical statistics do not depend on later timetables. Reconstruct legacy facts once with visible provenance.
- Include coverage breakdowns, affected-class and worst-day summaries, CSV export and a printable report.
- Use an established chart library and existing backend/storage infrastructure.

## Capabilities

### New Capabilities

- `substitution-statistics`: Historical facts, workload aggregation, dashboard filters and reporting.

### Modified Capabilities

- `substitution-rows`: Explicit uncovered outcome for a class and period.
- `app-shell`: Replace the Stats placeholder with a functional statistics screen.

## Impact

Backend domain rules, mutation/import paths, SQLite documents and archive validation; frontend routing, substitution outcome controls and a new Stats screen; Recharts dependency and lockfile. Backups must retain facts and JSON archives must round-trip them. No school-calendar integration, full timetable versioning, or Banca ore implementation is included.
