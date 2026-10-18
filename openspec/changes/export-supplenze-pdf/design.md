# Design

## Context

See proposal.md for motivation. The React daily view already receives date-specific rows with room and campus, grouped absent-teacher ids, assignments and type codes. `state.cf[day]` explicitly stores absent classes and periods. `absenceKinds` and `permitKinds` store the trip tag, without a relationship between a class and an accompanying teacher. `renderDis` combines manual `state.dis` and `autoDis`, retaining assigned teachers. The internal second-campus value is `succursale`; the export choice requested by the user is Separata. The existing JSON export is an archive, not a paper document.

Design is required because pagination, PDF generation and data projection introduce a new rendering path whose physical layout must be defined before implementation.

## Goals / Non-Goals

**Goals:** A read-only projection of the loaded day, deterministic physical page layout, selectable campus output and identical content when downloading or printing.

**Non-Goals:** Editing records in the export, changing scheduling or candidate eligibility, introducing class-to-trip relationships, or modifying the JSON backup format.

## Decisions

### Generate a vector PDF with explicit pagination

Use a browser-compatible PDF library behind a small dedicated generator, with A3 portrait dimensions and physical margins. Generate the document once, then offer download and a browser PDF preview for printing. Select a maintained library that supports font measurement, wrapped text, rules and page counters; bundle it locally. This avoids a server PDF service and additional database access. Browser HTML printing alone was considered, but reliable large top/bottom counters containing the final total are harder to control across browsers.

Calculate layout first, then render pages and stamp PAGE X/N after the final page count is known. Reserve top and bottom counter space on every page of multipage documents. Prefer consistent reserved margins even on single-page output to avoid pagination changing when counters appear. Counters use conspicuous bold type larger than body text.

### Separate content projection from rendering

Place the collapsed PDF controls at the bottom of the daily view, preselect the current page campus (Entrambe maps to both), and use a filled primary generation button without a format hint. Create a pure day-to-export projection, independent of the interactive table DOM. Preserve existing row identities, merged names, campus mapping, special assignment labels and saved assignment types. Include no controls, notes or attachments in the sheet. Capture a consistent loaded-day snapshot; disable generation while data is loading or mutations are pending, and report generation failures without altering state.

Build disposition membership from the same manual-plus-automatic source as the A disposizione panel, before excluding assigned people. Mark usage by teacher id and assignment period across the day's assignments, including assignments at another campus. Do not rebuild the candidate ranking to derive this section.

### Campus scope follows recorded evidence

Filter substitution rows by their recorded campus. Resolve disposition campus from manual disposition site or existing timetable/automatic-disposition evidence; do not guess from the campus of an assigned substitution. Map Centrale to `centrale` and Separata to `succursale` internally.

Absent classes and accompanying teachers are independent daily lists. Use recorded class absences directly and trip tags directly, deduplicating names; do not derive class absences from teachers' lessons or invent class/teacher links. As a conservative presentation default, supplementary records without unambiguous campus evidence remain visible on selected sheets with an unspecified-campus marker rather than being silently omitted. The independent trip lists can repeat on both campus sheets where campus ownership is unavailable. Missing-campus main rows must be surfaced as an export warning rather than silently lost. These are handling defaults for incomplete metadata, not changes to saved records.

### Lay out a paper form, with variable height periods

Use the supplied photo as the visual reference for header, ruled tables, period blocks and side-by-side lower sections. Add Aula / sede between Classe and Docente supplente, retaining adequate Firma width. Use black rules and text with fixed minimum writing-row height, wrapping long names and increasing populated row height when necessary.

Allocate at least eight rows per period, or actual rows plus two blank rows when greater; empty periods receive eight blank rows. Use a minimum 4.5 mm ruled writing height and thicker period boundaries. Additional blank rows can fill remaining space to resemble the paper form, but must not displace required content. Avoid forcing equal-sized period blocks when counts differ. Keep individual rows intact; split large period blocks at row boundaries and repeat their period label and column headings on continuation pages. Reserve the two required blank rows once per period, not twice for a split block.

Place lower sections after the main table, side by side when they fit. Paginate their content as necessary with repeated section headings; never truncate lists or shrink the entire sheet. Keep Classe and accompanying-teacher lists visually independent, with no shared row rules implying pairings. For disposition, render one comma-separated list in a single wrapping row per period and strike through only the individual names used in that period.

### Count the entire selected PDF

Centrale starts first, followed by Separata on a new page when both are chosen. Number every resulting page across the whole PDF. Thus a one-page sheet for each campus produces PAGE 1/2 and PAGE 2/2, top and bottom. Repeat date and campus on continuation pages to preserve context when sheets become separated.

## Risks / Trade-offs

- Physical dimensions and long names can expose clipping → measure wrapped content before pagination and visually inspect rendered A3 samples, including crowded and empty days.
- Campus metadata is incomplete for some supplementary records → use the explicit conservative fallback above and verify it does not imply trip pairings.
- Browser PDF viewers differ → provide a direct downloadable PDF even if automatic preview/print is unavailable; revoke object URLs only after use.
- Existing working-tree edits affect the same view → integrate narrowly with current source and preserve unrelated edits.

## Migration Plan

No data migration. Add the export UI and bundled generation module; rollback removes that UI/module without changing operational records. Verify with isolated fixtures and the standalone testing Compose project. Normal deployment, if requested for implementation review, keeps its existing operational database and uses only read-only deployment checks.
