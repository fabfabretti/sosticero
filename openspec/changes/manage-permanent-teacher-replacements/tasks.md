# Tasks

## 1. Person and appointment persistence

- [x] 1.1 Add the versioned ownership document and validators using existing storage; test separate source/person IDs, interval bounds, invalid references, source overlaps and person schedule conflicts on temporary synthetic databases.
- [x] 1.2 Add idempotent legacy identity mappings and historical person catalog support; verify unchanged ordinary datasets and balances, correct Benedetti attribution and no backend-import database side effects.
- [x] 1.3 Document person/source/absence/appointment semantics and inclusive periods; verify examples cover unfilled absence and successive replacements without copying personal debt.

## 2. Effective timetable and prolonged absence

- [x] 2.1 Extend shared timetable resolution through source overrides and dated ownership; test before/start/end/after dates, successive replacements, independent original absence, compatible revisions and preserved campus/class/room metadata.
- [x] 2.2 Remove canonical POT components during inheritance while retaining PE and other non-POT activities; test POT-only and mixed periods, permit daily limits and absence of inherited POT availability/demand.
- [x] 2.3 Compose derived prolonged absences with manual and permit sources and suppress covered originals; test Ianzano automatic demand, no-schedule days, Sicoli-only absence rows, no duplicate demand and retained Gambato ledger history.
- [x] 2.4 Apply effective eligibility across normal/RP/exceptional/paid assignments and manual/automatic availability; test covered originals and inactive/absent replacements cannot bypass restrictions and Sicoli can recover only her own debt.

## 3. Management API and protected corrections

- [x] 3.1 Add authenticated read, preview and apply endpoints for people, absence periods and appointments; verify admin-only management preview/apply permissions including direct non-admin API rejection, operational read access to resolved status, new-person catalog visibility and atomic rejection of invalid requests.
- [x] 3.2 Add impacted-record previews and revision/fingerprint checks for appointments and absences; test backdated conflicts, future paid activity, concurrent changes, unused deletion and safe ending without silently reassigning records.
- [x] 3.3 Preserve ownership, stable permit IDs and metadata for legacy combined identities; verify linked-RP conflicts, atomic failure and unchanged unrelated records. School-specific operational correction is separate maintenance; expose no reconciliation UI (see section 7).

## 4. Imports, archives and cross-feature integration

- [x] 4.1 Extend timetable import reconciliation for stable sources, changed identifiers, missing sources and independently imported replacement people; test compatible updates and explicit conflict review without duplicate schedules or silent name inference.
- [x] 4.2 Update Inbox/reception person matching and date-range validation; test ambiguous original-name items, coverage-boundary ranges and preservation of accepted personal identities and existing reception records.
- [x] 4.3 Update permit history/limits, reference checks, statistics, paid-hour readers, PDFs and public display to use effective person-based views; verify consistent dated names, demand, candidates and personal balances with integration fixtures.
- [x] 4.4 Version archive export/import and validate ownership documents against all state; test legacy imports, new round trips, malformed late failures with unchanged storage, attachments, fixed RP links and temporary SQLite online-backup restoration. Document compatibility and recovery restrictions.

## 5. Amministrazione management and operational displays

- [x] 5.1 Add admin-only Amministrazione management controls for prolonged absence, existing/new replacement people, dates, correction and ending; verify keyboard-accessible forms, error retention and previews of inherited hours, excluded POT and impacted records. Verify admins complete the workflow from their default panel without Orari access.
- [x] 5.2 Show dated ownership/coverage and unfilled absence clearly in Orari and timetable prints; verify greyed absent originals, Gambato's struck-through name beside Sicoli's clear name, crossed-out source POT with an explicit exclusion label, and successor transitions. Verify excluded POT remains outside effective calculations and operational users see no staffing write controls.
- [x] 5.3 Render locked derived prolonged absences identifying Amministrazione as the admin-only management location and covered-original suppression in Supplenze; verify Ianzano appears automatically and only Sicoli appears when absent during coverage. Preserve existing classification grouping and manual/permit locks.
- [x] 5.4 Update Permessi selectors/history and effective schedule inputs for separate personal identities; verify Gambato retains old hours and Sicoli's new permit affects only Sicoli. Add concise user documentation for these workflows.

## 6. Integrated verification and release

- [x] 6.1 Run relevant backend/frontend suites and production builds on isolated databases; verify lifecycle, baseline regression, concurrency, reconciliation and archive checks pass without reading large built bundles.
- [x] 6.2 Create a unique TEST_PROJECT and mktemp TEST_DATA_DIR; build/recreate only compose.testing.yaml with exported variables and LOCAL_UID/LOCAL_GID, inspect mount and allocated localhost port, verify testing=true and the red ribbon before behavioral writes, then check admin-only Amministrazione management without Orari access and the agreed read-only staffing display in Orari plus Supplenze/Permessi cases and stop only that project.
- [x] 6.3 Deploy the verified feature using ./scripts/deploy.sh and perform read-only deployed release/environment/asset checks; report the actual release and mount if deployment fails. Confirm deployment does not apply operational reconciliation or create absence records automatically.

## Workflow follow-up

- Ask whether the user wants to commit the work before making any commit.
- Actual Sicoli/Gambato reconciliation and Ianzano's prolonged absence require explicit reviewed operational application with their real IDs and dates; feature verification uses isolated data only.
- Archive this change only when requested after implementation and verification. Leave the earlier prototype change untouched unless separately requested.

## Verification record

- 2026-11-04: 318 backend tests passed; all 31 frontend test files passed. Production builds passed in the isolated container.
- Browser and HTTP acceptance used only sosticero-staffing-1793788750-77520 with /tmp/sosticero-staffing.0OqOPs, inspected bind mount, allocated localhost ports, testing=true and the red TESTING ribbon. Verified admin-only management, dated Orari display, excluded POT, automatic Ianzano absences and separate personal balances. The project was stopped afterward.
- Deployed with ./scripts/deploy.sh: incoming-20261104T105520-108811. Recovery snapshot verified by the script. Independent read-only HTTPS checks confirmed production testing=false, source snapshot 549d4dcb27fc306446297a039c2b0627b0b7190982c905329511959e84fac121 and current frontend assets.
- No operational staffing reconciliation or continuous-absence record was applied. Other existing parenthesized replacements remain unchanged. No commit made.

## 7. Staffing UX correction

- [x] 7.1 Replace the combined operation form with the active Assenze prolungate list and contextual Assegna supplente workflow; verify separate absence creation, existing/new person selection, period editing and preserved preview/conflict behavior.
- [x] 7.2 Remove school-specific reconciliation and source-mapping controls from staffing management; add code-and-name class selection and established keyboard teacher search; verify interaction tests and production builds.
- [x] 7.3 Verify the redesigned UI in an isolated testing project, stop that project, deploy with ./scripts/deploy.sh and perform read-only release checks.

### UX correction verification — 2026-11-04

- All 31 frontend test files passed; targeted admin/staffing/name backend checks passed (30 tests, followed by 19 checks for the final display-name lookup). Production builds passed.
- Browser acceptance on the isolated sosticero-staffing-ux-1793793875-120658 project verified the current Assenze prolungate list, separate absence creation, contextual Assegna supplente, explicit search/Enter selection, inline new teacher with A041 code and description, and per-operation save. The project used /tmp/sosticero-staffing-ux.YWyffx, an inspected mount/allocated localhost port, testing=true and the red ribbon; it was stopped after verification.
- Removed school-specific reconciliation and source-mapping sections from Gestione docenti. The one-time operational repair remains separate and was not performed.
- Final release incoming-20261104T121432-131282 deployed with ./scripts/deploy.sh. Recovery snapshot and release verified by the script; independent read-only HTTPS checks confirmed source snapshot d0378c29a8291341e95c2b4f0c2801cbd43d95a56e249962e9d814052efb1f40, production environment and current assets. No commit made.
