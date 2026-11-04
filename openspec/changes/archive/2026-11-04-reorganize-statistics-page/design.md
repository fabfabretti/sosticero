# Design

## Context

See proposal.md for motivation. Stats.tsx currently interleaves historical panels with StatsAvailability. The latter owns a date state and fetches /api/stats/availability for its containing week; POT-family counts already resolve that week. The historical report derives from captured absence slots, while classifications live in state.absenceKinds and state.permitKinds. Historical facts do not store classifications. Recharts is already installed. The two predecessor statistics changes remain unarchived, so their placement and visible-copy requirements must be reconciled when archiving; their counting semantics are preserved.

## Goals / Non-Goals

Goals: reorganize presentation without changing historical denominators, availability semantics or saved operational data; add derived breakdowns that reconcile with existing totals.

Non-goals: daily operational availability, inferred absence classifications, absence rates normalized to individual contractual workloads, or rewriting captured historical facts.

## Decisions

### Three tabs with stable component state

Use Andamento as the initial tab and persist a validated tab identifier in localStorage with a storage-failure fallback, following stats-campus. Tabs fit three separate destinations better than page-level accordions, which leave multiple chart groups expanded along a long page. Preserve smaller value disclosures.

Keep filter state and the availability component mounted across tab switches, hiding inactive views accessibly; avoid unnecessary hidden chart rendering where practical. Use proper tablist/tab/tabpanel relationships and arrow/Home/End navigation. Print preview exposes every section and supplies measurable chart containers; returning from preview preserves the active tab. Keep availability ready even for an empty historical report.

### Contextual help using existing patterns

Reuse the info-trigger appearance and existing tooltip/popover positioning and dismissal behavior. Neither current component alone implements the complete interaction contract: HourHelp has hover/focus, RecordInfo has click/tap. Make the smallest shared adaptation needed for hover, focus and pinned click/tap help, with meaningful metric-specific accessible labels. Split demand, teacher-hours and unique-teachers definitions between their own cards. Keep the recorded-day count visible, put detailed denominator rules in help/methodology, and expose actual quality warnings outside the collapsed method disclosure. Preserve methodological explanations in print.

### Read-time report enrichment without a fact migration

Extend the pure report boundary with optional classification maps and resolved display names supplied by /api/stats from its consistent read snapshot. Existing captured slots remain the source of historical campus and hour context; do not recalculate from today's timetable. Preserve the old report call behavior for callers without enrichment. Read-time joins allow classification corrections to appear without rewriting saved facts or extending the strict fact validator/schema.

For each filtered slot, resolve classification from its relevant manual/permit source. Proposed deterministic overlap default: prioritize last_minute, strike, trip, planned among applicable recorded sources, matching the operational UI's existing classification priority; if none is present use unclassified. Count the slot once. Retain teacher IDs as grouping keys and resolve names through the application's existing teacher-name mechanism rather than grouping by display name. Sort teacher rows by descending hours then display name and ID; distinct date sets supply days.

### Percentages and reports

Add absence-category hour and percentage values and teacher rows to StatReport. The denominator is totals.teacherHours, including hours without a class and unknown classifications. Empty denominators yield no pie; zero categories can remain in the readable legend. Use installed Recharts pie components with theme-compatible colors and an always-readable category/hours/percentage legend. Round only for display.

Append the new historical CSV sections, preserving existing sections and formula-safe escaping. Full print/preview includes the new breakdowns and all tabs, while availability keeps its separate dates and method. A saved tab changes navigation only, never report scope.

## Risks / Trade-offs

- Read-time classification enrichment cannot recover missing legacy metadata -> display Non classificata, never infer entry timing.
- Hidden panels can produce zero-sized charts or lose state on remount -> retain section state and verify all charts in print preview as well as after tab switching.
- Existing predecessor specs require placement below Giorno × ora and visible explanations -> explicitly record supersession here and reconcile those requirements during later archive/sync without discarding their calculation rules.
- Concurrent working-tree changes touch statistics and naming -> preserve unrelated work and integrate with current read/name resolution paths.
- Independent weekly and historical scopes can confuse users -> show availability week prominently and preserve separate labels in reports.

## Migration Plan

No operational database migration is planned. Verify focused calculations and UI in an isolated temporary test database/project, build, then deploy implementation with ./scripts/deploy.sh and perform read-only release checks. Stop only that test project. Rollback uses the prior application release; derived report fields require no data rollback. This planning change itself does not deploy application code.
