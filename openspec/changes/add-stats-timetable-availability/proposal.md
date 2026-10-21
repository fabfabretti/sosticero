# Proposal

## Why

Stats explains historical substitution outcomes but does not show on-paper staffing capacity for the selected campus. The office needs to see which timetable slots remain available and whether at least the expected 40% of combined POT, ALF and PE hours remain enabled.

## What Changes

- Keep Ore docenti assenti and explain visibly why absent teacher-hours differ from class-hours requiring cover and successfully covered hours.
- Add an A disposizione section below Giorno × ora, following the existing Centrale / Succursale / Entrambi campus selection, with a separate date/week selector allowing future dates.
- Show weekday-by-period Disponibili and Reperibili views with teacher names and activity details using Orari's hover/focus UI. Reperibili includes favourable Recupero Permesso opportunities, distinguished from ordinary availability.
- Compute on-paper availability from the applicable timetable and Orari disabled hours, ignoring daily absences, assignments, manual daily availability and released classes.
- Show enabled / total scheduled POT + ALF + PE hours and their combined percentage against a labelled 40% reference. All new calculations follow the selected campus; Entrambi combines both campuses with distinct teacher-period counts and a ratio of combined counts, not an average of percentages. DI.S contributes to the availability grids but never to this percentage.

## Capabilities

### New Capabilities

- `timetable-availability-statistics`: Campus-filtered on-paper weekly availability, favourable recovery opportunities and combined POT-family availability ratio.
- `statistics-metric-explanations`: Visible explanation of the existing historical absence, demand and coverage units without changing their calculation.

### Modified Capabilities

None. The existing statistics capability currently lives in the completed, unarchived implement-stats-page change; these additions complement it without copying or redefining its historical reporting requirements.

## Impact

- Backend: a read-only availability report using dated timetable resolution, effective overrides, hour-type policies and recovery eligibility; historical statistics facts remain unchanged.
- Frontend: Stats section, week/date controls, shared Orari tooltip presentation and report/export handling.
- Tests: focused backend and frontend coverage plus isolated container verification. No new dependency or database migration is expected.
- No production data changes, implementation or deployment are part of this proposal.
