# Tasks

## 1. Derived absence breakdowns

- [x] 1.1 Extend pure historical reporting and /api/stats read-snapshot enrichment with absence-category hours/percentages and teacher hour/day totals, preserving captured slot context; verify focused backend tests for campus/period filters, co-absence, manual/permit overlap and summary reconciliation.
- [x] 1.2 Resolve categories from absenceKinds and permitKinds using documented overlap priority and teacher names through current identity/name resolution; verify correction, missing legacy classification, duplicate names, removed/replaced teachers and empty-scope cases in focused backend tests.
- [x] 1.3 Extend frontend StatReport types to match the additive API fields; verify TypeScript compilation and API fixture compatibility without changing existing CSV sections.

## 2. Navigation and summary help

- [x] 2.1 Introduce Andamento, A disposizione and Classi e docenti tabs beneath the shared summary/outcomes with validated localStorage persistence and accessible keyboard behavior; verify initial selection, revisit, invalid/unavailable storage and keyboard switching in focused frontend tests.
- [x] 2.2 Regroup existing panels and preserve historical filters, availability week and value disclosures across tab changes; verify future-week POT results survive switching and availability remains usable with no historical absence days.
- [x] 2.3 Replace summary explanatory paragraphs with metric-specific (i) help by adapting existing info/tooltip patterns; verify hover, focus, tap/click, Escape, viewport bounds and visible quality warnings in both themes and narrow layouts.

## 3. Historical presentation and reports

- [x] 3.1 Add the absence-type pie and readable category/hour/percentage legend in Andamento using existing Recharts; verify matching summary totals, zero/unclassified categories, rounding and empty-state behavior in focused frontend tests.
- [x] 3.2 Add Assenze per docente beside Classi interessate with hours, distinct days and descending-hour ordering with deterministic ties; verify campus-filtered rows, duplicate display names and the agreed Italian labels.
- [x] 3.3 Append absence-type and teacher sections to historical CSV while retaining formula-safe text escaping; verify existing sections remain intact and new totals/units match the active historical scope.
- [x] 3.4 Update print preview/styles to show all sections and method notes regardless of active tab, preserving availability's separate week; verify nonzero chart sizes, complete tables, independent date labels and preserved active tab after leaving preview.

## 4. Integration and release

- [x] 4.1 Run affected backend/frontend checks and the frontend production build; verify all pass without reading generated minified bundles.
- [x] 4.2 Create a unique TEST_PROJECT and mktemp TEST_DATA_DIR and build/recreate only compose.testing.yaml with LOCAL_UID/LOCAL_GID and explicit -p; inspect its mount and allocated localhost port and confirm /api/environment testing=true and the red TESTING ribbon before changing isolated data. Verify tab/help/chart/print behavior there, then stop only this project and confirm the old local operational app remains stopped.
- [x] 4.3 Deploy the implemented feature with ./scripts/deploy.sh and verify the deployed release, served asset hash and mount using read-only checks; record the result without production behavioral mutations.
- [x] 4.4 Present the verified changes and ask whether the user wants to commit; verify no commit is made without explicit approval.

## Workflow follow-up

- When later archiving/syncing, reconcile this change's tab placement and contextual help with the unarchived predecessor statistics specifications; preserve their historical counting and weekly POT semantics.

## Verification record

- Backend: 34 focused statistics/classification/name/appointment tests passed; the two breakdown tests passed again after adding name-override and later-timetable removal assertions. TestClient required execution outside the sandbox because its async login transport stalled inside it; all databases were temporary.
- Frontend: all 31 test files passed; the three affected statistics/availability/attachment files passed again after the final legend adjustment. Production builds passed.
- Isolated project: `sosticero-stats-1793795233`, data mount `/tmp/sosticero-stats-data.6fPTCK:/data`, allocated localhost ports 44805 then 43149 after recreation. Both environment checks returned testing=true, and the browser showed the red TESTING ribbon. Final served assets: index-CUJLkm_g.js and index-CesPA8lM.css.
- Synthetic data reconciled six teacher-hours across the five absence categories and the teacher table. Browser checks confirmed remembered tab after reload, future-week preservation across tab switches, availability with an empty historical period, metric-help click/Escape and narrow-screen bounds, light/dark themes, pie/legend rendering and complete print preview with nonzero chart dimensions. Browser error logs were empty.
- Only this test project was stopped; no local operational app was started. Deployed via ./scripts/deploy.sh as incoming-20261104T124419-146290. The script verified the production data mount before replacement, complete recovery snapshot, expected replacement image and HTTPS release. Independent read-only HTTPS checks confirmed testing=false, exact source snapshot 08437cbd6b75310c93b60c419c9f2938bc4a80cc66ed70f1fc104c5cd2b45978 and available index-zjN6TU02.js / index-CesPA8lM.css assets. No production behavioral writes were used.
