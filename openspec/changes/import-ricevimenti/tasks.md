# Tasks

## 1. Reception storage and spreadsheet parsing

- [x] 1.1 Add independent dated reception snapshots with empty defaults and date resolution; verify tests cover first-effective boundaries, same-date replacement, later versions, empty clearing and independence from teaching overrides.
- [x] 1.2 Add a pinned backend XLSX reader and bounded parser for the supplied headers; verify generated fixture tests cover weekdays, integer periods, shortened time ranges, missing fields, duplicate slots and malformed workbooks. Document the accepted columns and whole-period exclusion.
- [x] 1.3 Implement conservative matching across imported and overridden names, explicit skips and optional campus overrides; verify tests cover normalized unique matches, ambiguity, unknown teachers, blank locations and a distanza.

## 2. Shared recovery rules

- [x] 2.1 Pass date-resolved receptions into candidate generation and assignment validation; verify tests reject RP at R even through direct requests or exceptional confirmation, without changing permit limits or non-RP policy.
- [x] 2.2 Extend RP context for reception adjacency and both-side travel checks with structured uncertainty; verify known-campus adjacency, unknown-campus explanations, both intervallo boundaries, existing teaching gaps and unchanged candidate ordering.
- [x] 2.3 Integrate receptions into availability statistics and saved-assignment issue detection; verify confirmed RP counts agree with shared eligibility and R never increases activity totals or silently releases recovery links.

## 3. Import API and portability

- [x] 3.1 Add reception preview and confirmed import endpoints with effective dates, mapping validation, affected-assignment impact, stale-preview protection and verified pre-import backup; verify isolated API tests cover concurrent changes, cancellation, invalid input, failed backup and atomic saves.
- [x] 3.2 Extend archive export/import and backup validation for optional reception data; verify round trips, legacy empty behavior, malformed versions, dangling identities and preservation of existing RP assignments and permit attribution. Document archive compatibility.

## 4. Settings and Orari

- [x] 4.1 Add the Ricevimenti Settings section with XLSX selection, effective date, row preview, searchable manual matches, explicit skips and optional campus confirmation; verify frontend tests cover unresolved rows, remapping, unknown locations and stale preview invalidation.
- [x] 4.2 Overlay R in date-specific Orari grids with accessible time/location details and overlap warnings; verify tests preserve both R and lessons and teaching edits cannot erase or move receptions.
- [x] 4.3 Show potentially favorable RP explanations outside the confirmed favorable group; verify drawer tests distinguish confirmed, uncertain and blocked opportunities. Document import review and location uncertainty in the project user documentation.

## 5. Integrated verification

- [x] 5.1 Run targeted backend/frontend suites and a production frontend build; verify reception integration and existing recovery, timetable and archive tests pass against isolated databases.
- [x] 5.2 Build and run a unique standalone compose.testing.yaml project with mktemp data and an allocated localhost port; inspect its mount and /api/environment before mutation, verify the TESTING ribbon, then exercise import, manual matching, Orari R, RP exclusion, uncertainty and history. Stop only this test project and confirm normal service remains untouched.

## Workflow follow-up

- Ask whether the user wants to commit completed work before creating a commit.
- Deploy to normal service only within the approved deployment scope, verifying the normal data mount and updated served asset with read-only checks. Importing operational reception data requires its own explicit request.
