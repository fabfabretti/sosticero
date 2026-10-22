# Design

## Context

See proposal.md for motivation. `renderDis` in `main.tsx` already merges manual entries with `autoDis`, retains assigned hours and exposes manual hour/site/removal/attachment actions. `RecordInfo` implements click-to-toggle accessible information with attachment links. The current candidate-selection spec still describes an older selected-hour list and excludes assigned teachers; the delta explicitly replaces that obsolete presentation. Existing sidebar tests exercise the actual rendered handlers.

## Goals / Non-Goals

**Goals:** Derive a compact table from existing data and retain editing and information access.

**Non-Goals:** Changing eligibility, assignment ranking, database records, other sidebar sections or the global information component's interaction model.

## Decisions

- Derive seven rows from the union of manual and automatic teacher-hours already supplied by the daily response. Deduplicate by teacher/hour and sort by displayed name. Avoid a new stored representation or API: both would duplicate existing state.
- Resolve campus per teacher/hour using an applicable manual `disSites` override first, then the effective daily timetable lesson's site, otherwise unknown. Use the effective dataset already returned for the selected date, including weekday lesson keys. Apply overrides only to manual hours, matching backend candidate location semantics. Do not infer campus from the class to which the teacher has been assigned; that describes the assignment rather than the availability.
- Compute Sconosciuto visibility from all displayed rows, including assigned entries, independently of the main substitution table's campus filter. Render semantic column and row headers, wrapping names within cells and retaining usable sidebar widths in both themes.
- Reuse the current assigned-hour lookup. Strike only the name, with an accessible assignment explanation in the adjacent information; keep the icon and links operable. Combine hour-specific automatic causes, assignment classes and saved manual attachment links in `RecordInfo` rather than adding another tooltip system.
- Turn table names into buttons that select one teacher editor beneath the table. Reuse existing hour toggles, site selection, removal and attachment controls there, protecting automatic hours. A separate selected teacher is needed because the existing `editingDis` state only controls manual attachment editing. Close/reset the editor and attachment drafts on date changes or when its teacher disappears. This keeps the table compact without discarding existing actions; permanent controls in every cell would repeat them up to seven times.

## Risks / Trade-offs

- Unknown campus adds width -> wrap names and verify narrow-screen layout and both themes.
- The same teacher appears in several rows -> keep one editor per teacher and separate name activation from information activation.
- Manual and automatic hours overlap -> deduplicate first and preserve locked automatic hours even after removing manual data.
- Existing uncommitted work touches main.tsx, styles and sidebar tests -> apply a focused diff without reverting unrelated work.

## Migration Plan

No migration is needed. Verify frontend tests and build, then behavior on an isolated `compose.testing.yaml` project/database with an allocated port, confirmed testing environment and ribbon. Stop only that project. Any approved normal-service deployment must rebuild and force-recreate normal Compose with the project data mount, followed by read-only asset checks. Rollback restores the prior frontend code and rebuilds without changing operational records.
