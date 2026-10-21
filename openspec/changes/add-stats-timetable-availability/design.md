# Design

## Context

See proposal.md for motivation. Stats.tsx currently gates its charts on recorded absence days and fetches historical facts from /api/stats. statistics.py counts absence slots independently of demand. timetables.dataset resolves effective versions and dated overrides. domain.py provides RP favourability, but its operational helpers account for daily absences, assignments and class releases. TeacherTimetables uses the shared HourHelp tooltip. Global activity policies are separate from per-slot disabled flags.

The statistics spec currently exists only in the completed implement-stats-page change. This change adds two bounded capabilities instead of duplicating that unarchived capability or changing historical fact semantics. Existing working-tree changes, particularly POT class associations and timetable overrides, must remain intact.

## Goals / Non-Goals

Goals: a read-only derived weekly report, consistent date resolution, transparent units and shared tooltip behaviour.

Non-goals: operational candidate recommendations, assigning recovery hours, rewriting historical facts, timetable editing, changing global policies or enforcing a 40% quota.

## Decisions

### Separate read-only availability endpoint

Add GET /api/stats/availability?date=YYYY-MM-DD&campus=total, defaulting to Rome today and accepting the existing centrale, succursale and total campus values (Entrambi in the availability UI). Return Monday–Friday dates, effective version metadata, cell lists grouped by ordinary and RP availability, and combined POT-family totals. Compute from a consistent database read transaction; do not persist derived results. Keep /api/stats unchanged. Combining it with the historical endpoint would conflate future timetable dates with historical report filtering and empty states.

### Resolve the week per date

Resolve timetables.dataset for each actual date, retaining overrides and active-teacher filtering. Apply presentation name overrides as Orari does. Reuse canonical activity normalization and campus conventions (including DI.S as Centrale); exclude unknown-campus activity hours from either named campus, include them only in Entrambi and disclose unresolved campus counts. Never infer a named campus merely because an unknown activity exists. Count distinct teacher-periods; mixed family labels count once. Filter inventory by the selected campus. Entrambi unions teacher-periods across campuses and divides combined enabled counts by combined total counts; never average campus percentages. The denominator is the effective scheduled POT/ALF/PE inventory before availability exclusions; the numerator respects disabled flags and global availability policy. Class-associated disabled POT remains in the denominator.

### Separate timetable capacity from operational state

Use timetable availability activities rather than the full row-specific candidate list: class compresenza and exceptional opportunities are not freely available. Respect global availability policy, not candidate visibility as a proxy for availability. Include enabled school availability activities matching the selected campus, including POT/ALF/PE and DI.S; no daily manual availability or class releases.

For RP, use existing permit debt and date-window rules, including already linked recovery reservations when determining outstanding debt. Do not alter the ledger or simulate debt consumption across grid cells. Evaluate favourability and travel from timetable commitments only, with no daily absences, bookings or class releases. Evaluate RP against the selected named campus; for Entrambi take the union of opportunities eligible at either campus and deduplicate teacher identities per slot. Preserve eligible campus labels in tooltips. Reuse rp_context with a clearly isolated neutral scheduling state or extract the timetable-only portion where necessary; do not change production candidate semantics. RP is only considered in free timetable slots. A single debt hour may qualify for several alternative cells; label this explicitly.

### Independent section state and shared tooltip

Add A disposizione below the existing heatmap, outside the recorded-day-only conditional. It remains visible when historical stats are empty and uses its own loading, error, retry and selected-week state, while sharing the existing Stats campus selector. Campus changes refresh both historical and timetable reports; historical period changes leave the selected availability week unchanged. Use a date input plus week dates, with Disponibili/Reperibili segmented views of the same weekday-by-period grid. Reuse HourHelp and existing accessible table styles. Show combined counts and the 40% reference immediately beside or below the grid; do not turn the reference into validation or an enforced threshold.

Keep the historical CSV schema unchanged. Print the new section with its independent scope and method, even for an empty historical report; adapt the print action's current recorded-day gate accordingly. The summary explanation uses visible Italian copy, not solely a hidden tooltip.

## Risks / Trade-offs

- Reusing operational eligibility could silently subtract absences or bookings → use neutral scheduling context and regression tests that vary daily state without changing grid results.
- Recovery debt is finite, so summed cell opportunities overstate capacity → show per-slot alternatives and never present their sum as available recovery hours.
- Dated overrides can change the weekly inventory → resolve every weekday independently, including midweek transitions.
- Unknown POT campus can distort the ratio → exclude unresolved campus slots from named-campus reports, include them in Entrambi and disclose their count; follow established Orari campus metadata instead of guessing.
- Existing uncommitted work touches related modules → preserve it and review the final diff by scope.

## Migration Plan

No schema migration or stored data changes. Verify calculations with temporary databases and UI behaviour through a unique standalone compose.testing.yaml project; confirm its isolated mount, allocated port and testing environment before interactions. Stop only that test project. A later approved normal-service deployment uses the required rebuild/recreate command and read-only mount and bundle checks. Rollback restores the previous code/image without database restoration.

## UI refinements after operational review

Coverage data is incomplete while Succursale uses a separate instance. Remove the
covered-hours summary card and percentage, preserve raw recorded outcomes with an
incompleteness caveat, and label class demand Ore da coprire. Keep teacher-hours in
the summary and daily chart, but only demand and distinct teachers in Giorno × ora.

Override the global small-screen rule hiding the final table header for Stats
weekday grids, and use fixed table layout so weekday columns shrink together.
Availability hover details use pointer-events:none so nearby cells remain
reachable; explicitly pinned details accept pointer input for scrolling.
Use compact teacher/activity/C-S lines under separate ordinary and RP headings.
