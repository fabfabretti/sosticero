# Proposal

## Why

Staff need a downloadable, complete weekly timetable that remains understandable on paper. The current Orari page hides compresenza names in tooltips and offers no timetable PDF download.

## What Changes

- Add a PDF download from Orari containing all scheduled active teachers, alphabetically, regardless of the search filter.
- Export the saved timetable valid on the selected “Orario al” date, including saved timetable and teacher-name overrides.
- Use A4 landscape pages with two teacher grids stacked vertically, identical timetable cell dimensions throughout, and Monday–Friday / hours 1–7 headers.
- Print class/activity, aula, Centrale/Succursale and all compresenza partner names inline. Repeat a compact legend and date header on every page.
- Include saved receptions and distinguish lessons, other activities and receptions with light colors. Omit substitution-specific availability flags and unknown-location placeholders for other activities. Keep PDF content selectable and machine-extractable.

## Capabilities

### New Capabilities

- `timetable-printing`: Complete teacher timetable PDF export with fixed layout and explicit location and compresenza information.

### Modified Capabilities

None. Existing timetable viewing and substitution printing behavior remains unchanged.

## Impact

Frontend Orari controls, timetable projection/types, a dedicated PDF generator and focused tests. Reuse the installed jsPDF dependency and existing `/api/orari` response, which already carries room data. No database migration or new API is expected. Screen layout redesign, filtered exports, class-based timetables and configurable page formats are out of scope.
