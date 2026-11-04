# Proposal

## Why

Statistiche has become a long page with explanations competing with the summary and unrelated analyses stacked together. Grouping its views and adding absence composition and teacher totals will make the information easier to find and interpret.

## What Changes

- Keep summary cards and the five outcome counts above three tabs: Andamento, A disposizione, Classi e docenti. Remember the last selected tab across visits.
- Replace the explanatory paragraphs below summary cards with accessible (i) controls next to each metric title, reusing existing information/tooltip patterns.
- Group historical charts, coverage methods, highest-demand days and a new absence-type pie chart under Andamento.
- Preserve A disposizione's own selected week, including week-dependent POT calculations, independently of historical period filters.
- Put class demand and a new Assenze per docente table under Classi e docenti; rank teachers by absent timetable hours and also show days with absence.
- Show absence categories as percentages of absent teacher-hours, including Non classificata; retain readable hours and percentages beside the pie.
- Preserve full reports across tabs and include the new historical breakdowns in CSV and print.

## Capabilities

### New Capabilities

- `statistics-navigation`: Persistent tab navigation, contextual metric help and full-report behavior across historical and weekly views.
- `absence-statistics`: Absence-type composition and teacher absence aggregates with consistent campus, period and teacher-hour units.

### Modified Capabilities

None in the main spec inventory. Historical statistics and timetable availability are currently described in the completed but unarchived changes `implement-stats-page` and `add-stats-timetable-availability`. This change supersedes their placement of A disposizione below Giorno × ora and their always-visible summary explanations; calculation semantics remain intact.

## Impact

Frontend Stats.tsx, StatsAvailability.tsx, stats-report.ts and styles; existing info/tooltip components; backend statistics reporting and /api/stats integration; focused backend/frontend tests and report rendering. Reuse installed Recharts for the pie; no additional dependency or operational-data migration is intended. Existing unrelated working-tree changes must be preserved.
