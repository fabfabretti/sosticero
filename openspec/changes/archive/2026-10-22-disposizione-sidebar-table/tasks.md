# Tasks

## 1. Availability table

- [x] 1.1 Replace the teacher-oriented renderDis output with seven semantic hour rows, campus cells, alphabetical names and empty-cell em dashes; derive campus from applicable manual override then effective lesson site. Extend sidebar tests for manual/automatic overlap, campus changes by hour, missing campus and sorting; verify with `cd frontend && node --test tests/sidebar.test.cjs`.
- [x] 1.2 Add Sconosciuto only when any displayed teacher-hour is unresolved, counting assigned entries; cover appearance, disappearance after editing/date changes and independence from the main campus filter in sidebar tests.
- [x] 1.3 Render assignment strikethrough on the teacher name for the matching hour only, and reuse RecordInfo for hour-specific causes, assignment class and attachment links; verify automatic and manual assignments, assignment removal, operable indicators and no editor opening on information clicks in sidebar tests.

## 2. Editing and layout

- [x] 2.1 Open one teacher editor beneath the table from any occurrence of its name, retaining manual hours, campus, removal and attachment actions with locked automatic hours. Reset selection/drafts on date changes or teacher removal; verify existing mutations and attachment preservation plus overlapping automatic/manual removal with sidebar tests.
- [x] 2.2 Style the table and editor using existing tokens, wrap names and keep the information indicator outside strikethrough; verify keyboard access, touch/click information, Escape dismissal, both themes and narrow widths during the isolated browser check.

## 3. Integration verification

- [x] 3.1 Run `cd frontend && npm test && npm run build`; confirm all frontend tests and the production bundle build pass without reading minified bundles.
- [x] 3.2 Rebuild and force-recreate a uniquely named standalone compose.testing.yaml project with an isolated mktemp database directory and allocated localhost port. Inspect its mount/port, confirm /api/environment testing=true and the red TESTING ribbon before writing fixtures; verify the table, conditional column, strikethrough, information and editing in the browser, then stop only that test project. Keep normal service untouched and report the results.

## Workflow follow-up

- Ask the user whether to commit before making any commit.
- Deploy to normal service only when approved, using the required build/force-recreate command and read-only mount/bundle checks against the operational database.
