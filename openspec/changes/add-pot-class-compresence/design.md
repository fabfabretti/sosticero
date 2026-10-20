# Design

## Context

See proposal.md for motivation. Special-hour overrides currently allow only classless activities and conserve their payloads when moving hours. Candidate eligibility checks imported codes before same-class co-teaching; disabled hours also suppress class-out release. Existing same-class ITP/support candidates can be assigned normally.

## Goals / Non-Goals

**Goals:** Reuse dated overrides and existing classroom eligibility semantics while preserving ordinary disabled POT behavior elsewhere.

**Non-Goals:** General editing of imported lessons, new policies for other activity codes, or changes to operational timetable data during development.

## Decisions

- Store the association in the effective POT lesson's classes field, limited to one existing class and an individually disabled POT hour. Reuse the existing timetable and class-out model instead of introducing a separate scheduling source. Override validation must distinguish editable POT associations from immutable imported teaching lessons and conserve activity independently of editable POT class and campus metadata; non-POT campus values remain conserved.
- Extend dated override serialization and conflict comparisons so associations survive moves, reset, reimport review and archive round trips. Existing association-free documents need no destructive migration. Reactivation removes the class atomically; cancelling editing changes nothing.
- Resolve class-out release and matching-class POT compresence before the general disabled/code branch. Reuse existing co-teacher campus and room checks and POT visibility policy. Preserve absence, retirement and double-booking restrictions. Other-class candidates follow existing disabled POT rules. Carry a distinct POT compresence label/category through assignment display, export and statistics without counting it as ordinary free POT availability.
- In timetable edit mode, open the class and campus editor on click or double-click of POT. Use a separate availability button so editing cannot reactivate POT. Keep future override history expanded and available while editing, confirming draft discard before deletion. Use a class selector from the effective timetable, show POT and class together, and clear association on reactivation. Keep existing drag/move behavior for POT payloads with associations.
- Filter POT-origin absence rows using effective same-hour classroom presence before applying existing merging. Suppressing a POT-origin row must not suppress an independently required ordinary-teacher absence row.

## Risks / Trade-offs

- Class membership affects weekly profiles and timetable partners: audit shared class consumers so the association is represented consistently and does not silently create duplicate rows.
- Existing conservation checks include classes: adapt validation narrowly for disabled POT rather than allowing arbitrary lesson edits.
- Changed rows may orphan stored assignments: preserve assignments and use existing review reporting; never silently migrate or delete them.
- Double-click can conflict with toggles and dragging: cover event behavior and accessible alternatives in frontend tests.

## Migration Plan

Use backward-compatible optional association data and preserve existing operational records. Verify meaningful backend and frontend behavior against isolated temporary databases. Container verification uses a unique project and temporary data directory with compose.testing.yaml, verifies its mount, allocated localhost port, testing API and TESTING ribbon, then stops only that project. Normal deployment remains untouched by tests. Deployment after implementation follows repository instructions; rollback retains stored association records and uses a compatible build.

## ALF extension

The office confirmed ALF uses the same classroom-commitment behavior as POT. Restrict this shared behavior to single-code POT and ALF hours, preserving other activities. Persist ALF compresence with category CA and its own display label; CP remains POT. Class editing and campus controls use the actual code in their labels. Existing policy visibility and hard candidate restrictions continue to apply.

## Activity editor UX

Use a native modal dialog outside the grid for POT/ALF details, preserving grid geometry and native focus containment/Escape handling. Reuse Supplenze's normalized contains/prefix class search, six suggestions, arrow/Enter selection and existing suggestion styles. Use the existing selected-button style for three mutually exclusive campus buttons. Dialog edits apply to the timetable draft only; cancel never changes it.
