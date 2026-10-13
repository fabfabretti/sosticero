# Design

## Context

See proposal.md for motivation. FastAPI reads JSON documents from SQLite through Store; React/TypeScript uses existing CSS and a Stats placeholder route. Absences and permits persist teacher/date/period lists. Assignment keys encode teacher, period and class; values retain substitute, type and class, but no campus. Rows are computed from the current timetable, merge co-absent teachers and hide classes marked out by entry/exit. Timetable import replaces the dataset and retains operational state. No historical calendar or timetable versions exist.

## Goals / Non-Goals

**Goals:** preserve facts at recording time; make operational corrections and statistics agree; keep aggregation in one backend implementation; reuse existing infrastructure and a maintained chart library.

**Non-Goals:** reconstruct unavailable historical truth, infer supervision from missing assignments, build a timetable archive or school calendar, or introduce analytics infrastructure.

## Decisions

### Persist facts beside operational state

Add a versioned statistics document using existing SQLite storage. Store date-keyed absence facts identified by teacher/period with saved campus, classes and manual/permit source flags; retain absent periods with no scheduled class as well. Store demand facts identified by date/class/period with absent teacher IDs, campus, outcome, assignment type, exceptional flag and provenance. Retain context needed to recompute an affected date after a correction without consulting a replacement timetable for unchanged facts. Preserve minimal source lesson context, not entire timetables or rendered charts.

Alternative: derive on every Stats read. Rejected because timetable imports would rewrite history and pending rows and campus cannot be recovered from assignments alone. Full timetable versioning is unnecessary for these reporting facts.

### Synchronize on writes, preserve on timetable import

Absence, permit, class-out and assignment mutations update affected facts in the same transaction as operational state. Preserve the context of unchanged teacher/period facts; new absence facts use the current timetable. Rebuild affected class-period facts from saved context, union manual and permit periods, group co-absent teachers, and apply class-out/outcome rules. Deleting an absence removes its statistical contribution; an orphaned assignment remains operationally retained and disclosed separately. Availability and policy changes do not rewrite recorded historical type/campus/outcome metadata. Replacing an outcome updates it; clearing returns it to pending.

Timetable import first ensures missing legacy facts are captured against the old dataset, then replaces the dataset without rebuilding existing facts. Startup initialization is transactional and idempotent, tracked by document schema/version; Stats GET remains read-only. Missing facts in a legacy archive are rebuilt against the available dataset with reconstructed provenance. Archive replacement replaces facts alongside state rather than merging stale statistical dates. A supplied facts document is validated for identity, dates, periods, campus, outcomes and consistency with supplied state before atomic import.

### Model uncovered as a manual outcome

Use a reserved assignment value such as UNCOVERED, with a distinct outcome type, in the existing assignment flow. Offer Scoperta with manual actions in the candidate drawer. Domain validation permits it only for an existing demand row. It is never a teacher, never contributes to teacher assignment loads, never marks a class out and never changes teacher availability. Review all sentinel handling, archive validation, issue detection and UI rendering rather than assuming existing teacher-assignment paths work unchanged. Keep DIR as its own manual coverage subtype; ENTRA and ESCE remain distinct outcomes.

### Capture demand before outcome suppression

Generate statistical demand from saved absence context before ENTRA/ESCE suppress the live rows. A class explicitly recorded absent through cf generates no cover demand for those periods; an ENTRA/ESCE decision resolves existing demand as late entry/early exit instead of erasing it. Each demand period has one outcome. Existing assignment validity must not be judged using a replacement timetable; check against saved context and recorded operational facts. Unresolvable legacy assignments are a separate warning/count, not valid cover.

### Dated heatmap details

Return each cell’s dated observations alongside its mean, including zeroes on recorded dates, using the same campus-filtered counts as the charts. The cell renders a fixed-position tooltip on hover/focus, bounded to the viewport with a scrollable list and Escape dismissal. This adds no stored data and no extra fetch per hover.

### Centralize aggregation and denominators

Expose a read-only Stats endpoint accepting campus and inclusive ISO date bounds. Resolve presets in Europe/Rome, use Monday-based weeks, and exclude future dates from reporting. All starts at the earliest absence; if none exist return an empty result. Use the global set of dates with nonempty unioned absences, irrespective of campus. For weekday charts divide by recorded occurrences of each weekday; for period charts divide by all included days; heatmap cells divide by their weekday's day count, including zero cells. Return null/unavailable averages when a denominator is zero, rendered as an empty state or dash.

Count absent teachers uniquely per date; teacher-periods uniquely by teacher/period; demand by class/period. Campus is attached to affected lessons/absence facts, never substitute location. Unknown campus contributes only to Totale and an explicit unknown summary. Teachers present in absence facts at both campuses count in each applicable campus but once in Totale; therefore teacher headcounts are not additive. Document that distinction. Coverage = covered / all demand; report uncovered, late entry, early exit and pending independently. Breakdown dimensions such as exceptional cover overlap covered subtypes and are labelled accordingly.

### Reuse Recharts and existing application styling

UI refinement: use the planner's sidebar, segmented-button classes and month-calendar styles. Show daily averages prominently in a compact ruled summary row, with totals secondary. Presets highlight the resolved calendar interval; two clicks select a custom inclusive range in either direction, with month navigation preserving the first selection. The daily chart shows three labelled lines together, distinguished by both color and dash style; weekday and hour averages show only class-period demand as single-series bars. Demand is labelled Ore di classe scoperta and highlighted in the summary; the explicit uncovered outcome is labelled Senza supplente to distinguish it from demand subsequently covered. The heatmap has weekday column headers and period row headers. A visible summary note distinguishes teacher absence periods (including non-class activity) from class-period cover demand. Heatmap metrics use segmented buttons. Keep methodology and provenance available in an expandable section, expanded in print preview.

Add Recharts for daily and categorical bar/line charts; verify the selected release's React 19 compatibility during installation. Use an accessible HTML grid/table for the small 5-by-7 heatmap and tabular equivalents for chart values. Avoid a second chart library. Keep Italian labels, current light/dark themes and responsive layout. Lead with demand cards, then trends/patterns, outcomes and class/day summaries. CSV uses the same aggregation payload and includes filters, units, denominators, provenance and unknown/invalid context. Browser print CSS supplies the printable report without a PDF service.

## Risks / Trade-offs

- Legacy timetable context is unknowable → label reconstructed facts and unresolved records; never present reconstruction as contemporaneously captured truth.
- Stored facts can drift from state → one transaction-level synchronization path for all mutations/imports, with regression tests around corrections and restart.
- Historical corrections may add new facts under a newer timetable → preserve unchanged facts and label newly captured/reconstructed context; do not silently regenerate the whole archive.
- Recorded-day averages exclude zero-absence school days → display the denominator definition and counts in screen and exports.
- Campus headcounts may overlap → deduplicate Totale and explain why campus headcounts need not sum.
- Older app versions may discard new facts or reject uncovered sentinels → document archive compatibility and retain a pre-deployment backup.

## Migration Plan

Implement additive document initialization without modifying existing operational records. Before normal deployment, verify migration, legacy imports, corrections, timetable replacement and outcome handling against a temporary database, using SQLite online backup for realistic data if needed. Use an explicit temporary Compose override replacing the entire /data mount, verify the mount before behavioral tests, and rebuild/recreate the container. Never copy test data back. Restore normal Compose deployment, verify the project data mount and served asset hash using read-only checks. Rollback uses the prior image and a deliberate restore of the pre-upgrade backup if needed; records created after that backup require preservation before rollback.
