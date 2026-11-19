# Tasks

## 1. Future periods

- [x] 1.1 Update report date filtering and calendar selection for future custom ranges while preserving today-limited presets; verify backend and calendar tests cover past, mixed, future-only and empty ranges.
- [x] 1.2 Add estimate warnings to screen, print and CSV scope, including future ranges without recorded data; verify display and export tests.

## 2. Charts and tables

- [x] 2.1 Exclude unclassified hours from the absence pie, retain them in the table and label both denominators; test mixed, unclassified-only and empty data.
- [x] 2.2 Add a coverage-type pie with accessible values and correct valid-covered denominator; test multiple types, exceptional coverage and no coverage.
- [x] 2.3 Limit long tables to 10 rows by default and in print with expansion and omission counts; test ordering, expanded print behavior and full CSV export.

## 3. Copy and print

- [x] 3.1 Shorten Italian copy and remove repeated methodology while retaining necessary definitions and warnings; verify the page and report remain understandable.
- [ ] 3.2 Refine print layout and page breaks; inspect print preview and rendered print with representative long, empty and future data, and update relevant user documentation.

## 4. Integration and release

- [x] 4.1 Run appropriate backend and frontend checks and verify the complete workflow in an isolated testing Compose project, including its TESTING indicator and environment endpoint.
- [x] 4.2 Stop the isolated project, deploy with `./scripts/deploy.sh`, and verify the deployed release using read-only checks.
