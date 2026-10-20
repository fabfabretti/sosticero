# Tasks

## 1. Backend ranking and policy consistency

- [x] 1.1 Replace the legacy category table and competing sort priorities with explicit tier classification and one sort key; verify a full ordered fixture covering every tier, both target campuses, unknown campuses, disabled entry/exit and Scoperta last.
- [x] 1.2 Apply effective availability, visibility and in-school fallback policies consistently, including custom activities and multiple codes; verify domain/API tests cover PE/ALF/staff, hidden types, unavailable outside-school/unset policies, same-class compresenza and direct assignment rejection.
- [x] 1.3 Resolve DI.S/UTC to centrale, UTS to succursale and DISP from explicit manual location or the released lesson; verify fixed-campus and cross-campus tier tests without changing DISP precedence.
- [x] 1.4 Add CDC affinity for the selected substituted lesson and combine it equally with existing weekly class affinity; verify exact target matching, unrelated absences, missing CDC, both matches, daily/total workload ties, stable name/ID ordering and the documented grouped-row default.
- [x] 1.5 Keep hard-blocked candidates in their ranked positions and RP convenience inside RP only; update obsolete ordering expectations and verify absence/double booking cannot be overridden, permit eligibility/accounting remains intact and workload totals retain their current meaning.

## 2. Candidate drawer and explanations

- [x] 2.1 Extend the Candidate type and render independent star labels “Insegna nella classe” and “Insegna la stessa CDC” using existing styles; verify frontend tests cover either, both and no matches, with readable labels in light/dark themes.
- [x] 2.2 Align drawer headings and main-page priority copy with backend tiers; verify frontend tests preserve server order, separate favourable/other RP, keep blocked reasons and exceptional confirmation, and put Scoperta last.
- [x] 2.3 Run the frontend test suite and production build; verify successful compilation without inspecting full minified assets.

## 3. Integration verification

- [x] 3.1 Run backend regression tests using isolated temporary databases; verify candidate API ordering, assignment validation, timetable overrides, saved assignments and RP lifecycle pass without operational data access.
- [x] 3.2 Build/start a uniquely named standalone compose.testing.yaml project with mktemp TEST_DATA_DIR, TEST_PROJECT, LOCAL_UID and LOCAL_GID; inspect its mount/allocated localhost port and testing:true environment before mutations, then verify the TESTING ribbon, mixed-tier drawer, stars and disabled reasons. Stop only that test project and verify normal service remains on the project's data directory.

## Workflow follow-up

- Ask whether the user wants to commit the completed implementation before committing.
- Deploy an approved implementation with the normal compose build-and-force-recreate command; verify the operational data mount and updated served asset hash using read-only checks.
