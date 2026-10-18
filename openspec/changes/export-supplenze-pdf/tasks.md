# Tasks

## 1. Read-only export content

- [x] 1.1 Add a pure daily export projection using existing rows, assignment labels/codes and campus values; verify fixtures cover merged absences, unassigned rows, special assignments and Centrale/Separata filtering without input mutation.
- [x] 1.2 Project recorded absent classes and independently tagged accompanying teachers, plus manual/automatic A disposizione by period; verify fixtures cover unequal independent list lengths, duplicate teachers, POT exclusion and period-specific strike-through, including cross-campus usage.
- [x] 1.3 Apply the design's explicit campus-evidence and unknown-campus handling; verify incomplete supplementary metadata remains visible with a marker and missing-campus main rows cause a visible warning rather than silent omission.

## 2. A3 PDF layout and pagination

- [x] 2.1 Add the locally bundled PDF generator with A3 portrait dimensions, measured/wrapped text, school/date/campus header, required columns and signature space; verify an exported sample's dimensions and visually inspect long names and Aula / sede placement.
- [x] 2.2 Lay out periods 1–7 with at least eight rows each, populated rows plus at least two blank writing lines, and thicker period boundaries; verify empty and unevenly crowded fixtures preserve every row and writing line.
- [x] 2.3 Add the independent class/accompanying-teacher section and period-based disposition section with one wrapping comma-separated list per period and assigned names individually crossed out; render a sample and verify both lower sections, blank writing space and selective strike-through against the reference layout.
- [x] 2.4 Implement continuation at row boundaries and repeated context/headings, starting each campus on a fresh page; verify crowded main and supplementary sections paginate without clipping or shrinking.
- [x] 2.5 Stamp prominent PAGE X/N indicators at top and bottom after calculating the complete PDF page count; verify single-campus overflow and combined-campus samples have correct global totals on every page, including PAGE 1/2 and PAGE 2/2 for two single-sheet campuses.

## 3. Export controls and user guidance

- [x] 3.1 Add a distinct daily print/PDF control and Centrale/Separata/both selection prefilled from the page filter before generation, placed below the table with a filled generation button and no format hint; verify the selected date is used, both generates one document, and the existing JSON backup control continues to work.
- [x] 3.2 Offer download and printable PDF preview with loading/error handling and object URL cleanup; verify generation cannot race pending day loads/mutations and a download remains available if preview is blocked.
- [x] 3.3 Document A3 portrait printing, campus selection, handwriting lines, strike-through and pagination in existing user documentation; verify instructions match the completed controls and output.

## 4. Integrated verification

- [x] 4.1 Run frontend tests and production build, then exercise the export in a unique standalone compose.testing.yaml project with a mktemp data directory; inspect its mount/allocated port and verify /api/environment reports testing=true and the red TESTING ribbon before fixture mutations.
- [x] 4.2 Render and visually inspect representative generated PDFs: empty day, realistic single campus, both campuses, long names, crowded periods and overflowing lower sections; verify A3 size, full content, writable blank rows, strike-through and top/bottom page counters. Stop only this test project afterward.

## Workflow follow-up

- Present implementation results and ask whether the user wants to commit before committing any work.
- If normal-service deployment is requested, rebuild/recreate normal compose.yaml service with its project data mount and read-only checks; never deploy or copy the testing database as normal data.
