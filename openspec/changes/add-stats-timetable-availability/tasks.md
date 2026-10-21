# Tasks

## 1. Timetable availability report

- [x] 1.1 Implement a pure campus-filtered weekly availability report resolving effective timetables, dated overrides, active teachers, canonical activities and global availability policies. Verify tests cover Centrale, Succursale and Entrambi selection, shared-teacher deduplication, unknown-campus disclosure, campus distinctions, DI.S, disabled/class-associated POT, mixed codes, duplicate prevention and midweek changes.
- [x] 1.2 Add combined enabled / total POT+ALF+PE counts and percentage with the 40% reference, excluding DI.S and disclosing unresolved campus counts. Verify each campus uses its own inventory, Entrambi divides combined counts instead of averaging percentages, 18/50 produces 36%, disabled hours remain in the denominator and zero total yields an undefined percentage.
- [x] 1.3 Add favourable theoretical RP opportunities using existing date-eligible debt and timetable-only favourability/travel rules. Verify deadline boundaries, reserved recovery debt, free-slot eligibility and invariance under daily absences, assignments, manual availability and class releases; retain existing operational candidate tests.
- [x] 1.4 Expose the read-only availability endpoint with validated campus and selected date, default Rome date, scoped week metadata and presented teacher names. Verify API tests use temporary databases, cover future dates and confirm no persisted data changes; document endpoint scope and theoretical units in the project's API documentation or nearby report documentation.

## 2. Stats presentation

- [x] 2.1 Keep Ore docenti assenti and add visible Italian explanatory copy near the historical summary cards. Verify the rendered explanation distinguishes teacher-hours, class demand and valid coverage without changing report values or outcome breakdown.
- [x] 2.2 Add the independently loaded A disposizione section below Giorno × ora, including selected campus/week labels and the shared Stats campus selector, future-capable date selection, Disponibili/Reperibili views and loading/error/empty states. Verify frontend tests cover campus switching for both reports, independent period/week filters and availability with an empty historical report.
- [x] 2.3 Reuse Orari's HourHelp tooltip presentation for named ordinary/RP groups and activity labels; show the combined POT-family ratio and theoretical-method copy. Verify hover/focus, Escape, long lists, narrow screens and both themes, plus correct counts and displayed 40% reference.
- [x] 2.4 Preserve historical CSV fields and include independently scoped availability in print output, allowing printing when only availability data exists. Verify frontend report tests and print preview preserve date/campus boundaries and exclude RP from the POT-family ratio.

## 3. Integration verification

- [x] 3.1 Run relevant backend/frontend suites and the frontend production build; verify existing Stats, Orari, recovery and timetable override checks pass with the new integration.
- [x] 3.2 Build/recreate a unique standalone compose.testing.yaml project with a mktemp data directory and allocated localhost port. Verify its mount, /api/environment testing flag and red TESTING ribbon before UI interactions; exercise all three campus options, combined counts, future week selection, tooltips, ratio and print preview, then stop only that project and confirm normal service remains untouched.

Verification for 3.2: rebuilt/recreated isolated project
`sosticero-stats-1792531801`, using data directory
`/tmp/sosticero-stats-availability.MLmVUw` and allocated ports 41041,
then 38361 after recreation. Mount and testing environment were verified.
The served bundle was `/assets/index-69AmYQ0G.js`.
Synthetic API checks passed for all campus filters, combined ratios, disabled
overrides, future weeks and invariance under daily absences. Browser checks at
`/#/stats` confirmed the red TESTING ribbon, all campus filters, future weeks,
ordinary/RP tooltip groups, Escape dismissal, light/dark themes, narrow layout,
both print-preview grids and availability with no historical absence days.
The test project was stopped; normal service retained its original container.

Regression verification: 177 backend tests passed, all 11 frontend test files
passed, and the production frontend build completed. Focused Stats/tooltip tests
also passed after adding the final keyboard and long-list checks.

## 4. UI refinements after operational review

- [x] 4.1 Equalize weekday column widths and restore the Friday header on narrow Stats grids; verified both tables at 390px and 700px with equal measured weekday widths.
- [x] 4.2 Use compact name/activity/C-S teacher lines in separate Disponibili and Reperibili (RP) groups; make hover panels pointer-transparent with a single active panel, and support click/Enter pinning, keyboard scrolling and Escape; verified with 28 synthetic teachers.
- [x] 4.3 Remove the incomplete covered-hours summary and its percentage, label demand Ore da coprire, and remove teacher-hours from the heatmap selector only; frontend tests verify three summary cards and two heatmap options.
- [x] 4.4 Pass the frontend suite and production container build, verify the refined UI in an isolated standalone test project, then stop only that project.

## Workflow follow-up

- Present the completed change for review and ask whether the user wants to commit before committing.
- Deploy to normal service only when approved, using the required build/recreate command and read-only operational database mount and served bundle checks.
- Archive through the OpenSpec archive workflow when requested; coordinate the still-unarchived historical Stats specification at that time.
