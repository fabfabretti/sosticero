# Tasks

## 1. Historical facts and migration

- [x] 1.1 Add versioned dated absence/demand facts using existing SQLite documents, with saved context and provenance; verify fixtures for permit overlap, co-absence, unknown campus, no-class hours and entry/exit demand.
- [x] 1.2 Implement atomic synchronization for absence, permit, class-out and assignment writes, preserving unchanged historical context; verify correction/deletion and rollback tests, including corrections after timetable replacement.
- [x] 1.3 Add idempotent legacy initialization and preserve facts on timetable import; verify repeated startup, restart and a changed-campus/reduced-timetable import leave existing statistics unchanged and operational records intact.
- [x] 1.4 Extend archive validation/export/import to replace facts atomically and reconstruct legacy imports; verify round trips, malformed-facts rollback, orphan disclosure and database backup/restore. Document reconstruction limits and older-version compatibility in README.

## 2. Explicit uncovered outcome

- [x] 2.1 Add the uncovered sentinel to assignment/domain/archive rules, excluding it from teacher loads and class-out logic; verify merged-row persistence, replace/clear, invalid-row rejection and unchanged availability.
- [x] 2.2 Add Scoperta to candidate drawer/manual actions and saved-row labels using existing UI conventions; verify selecting, reloading, clearing and replacing the outcome. Document its distinction from pending and entry/exit.

## 3. Statistics aggregation and API

- [x] 3.1 Implement aggregation from saved facts with campus filters, unknown-campus disclosure and unique teacher/class-period counts; verify co-absence, cross-campus deduplication and outcome reconciliation fixtures.
- [x] 3.2 Add period selection, Europe/Rome preset boundaries, common recorded-day denominators and zero-cell handling; verify weekday/period/heatmap averages, blank-day exclusion, future-date exclusion, invalid ranges and empty periods.
- [x] 3.3 Expose the read-only Stats endpoint with daily series, breakdowns, class/day summaries and provenance; verify response totals, invalid inputs and that reads do not write records. Document endpoint fields, units and denominator semantics.

## 4. Stats dashboard and reporting

- [x] 4.1 Install a React-19-compatible Recharts release and update the lockfile; verify dependency installation and the TypeScript/Vite build.
- [x] 4.2 Replace the Stats placeholder with Italian campus/period controls, summary cards and loading/error/empty states; verify direct route access, filter changes and stale-response handling with meaningful frontend tests.
- [x] 4.3 Add charts, accessible weekday-period grid, coverage breakdowns and worst-day/affected-class summaries using the API payload; verify displayed totals against fixtures, keyboard access, light/dark themes and narrow layouts.
- [x] 4.4 Add CSV export and print styling with filter/denominator/provenance metadata; verify CSV escaping and numerical parity, inspect browser print preview, and document reporting caveats in README.

## 5. Integration and deployment verification

- [x] 5.1 Run the relevant backend/frontend suites and production build; verify the integrated absence → pending → uncovered → covered and entry/exit flows without conflating their totals.
- [x] 5.2 Deploy with an explicitly selected temporary Compose override replacing the full /data mount, using LOCAL_UID/LOCAL_GID and --build --force-recreate; verify the mount before mutations and test migration, timetable replacement, dashboard/export and persistence exclusively on the isolated database.
- [x] 5.3 Recreate normal deployment without the override using LOCAL_UID/LOCAL_GID and --build --force-recreate; verify /data points to the project's data directory and HTTP serves the updated asset hash using read-only checks. Report any restore failure and database currently in use.

## 6. Reporting UI refinement

- [x] 6.1 Replace dropdowns with existing segmented controls and a visible range calendar; verify preset boundaries, reverse and cross-month selections and stale-response handling in frontend tests.
- [x] 6.2 Compact the summary around daily averages, show three chart lines with legends and retain accessible tables and print notes; verify the build, frontend tests and desktop/mobile browser layout.
- [x] 6.3 Rebuild/recreate against an isolated database and verify its mount, then restore normal deployment and confirm the main mount and updated served bundle with read-only checks.

## 7. Metric clarity and average charts

- [x] 7.1 Trace the reported Centrale difference, explain the counting units beside the summary, and use grouped bars for weekday/hour averages; verify the specific arithmetic, regression tests, build and isolated deployment, then restore normal service.

## 8. Focus on class-period demand

- [x] 8.1 Highlight and rename demand to Ore di classe scoperta, show only demand in average bar charts and transpose the heatmap; verify frontend tests/build and isolated deployment, then restore the main mount and served bundle.

## 9. Dated heatmap tooltips

- [x] 9.1 Return dated observations with heatmap cells and show a viewport-constrained hover/focus tooltip; verify zeroes, campus/period/metric filtering, keyboard dismissal, build and isolated deployment, then restore normal deployment.

## Workflow follow-up

- Ask the user whether to commit before committing any work.
- Archive the change only when implementation and review are complete.
