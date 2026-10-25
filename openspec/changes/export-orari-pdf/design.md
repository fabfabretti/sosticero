# Design

## Context

See proposal.md for motivation. TeacherTimetables loads `/api/orari?day=...`; its dataset contains resolved saved timetable overrides, displayed names and receptions. Lesson room values already exist in backend data, but frontend Lesson and TimetableCell types currently omit them. buildTeacherTimetables already derives distinct compresenza partners from shared class/day/hour and selects active scheduled teachers, including reception-only teachers. The screen renders partner names via tooltips. Substitution PDF generation already uses the installed jsPDF library.

The original view-teacher-timetables change describes inline partner names, while the current screen uses tooltips. This change defines explicit PDF behavior in a new capability without changing that screen contract or rewriting an unrelated pending spec.

## Goals / Non-Goals

**Goals:** Keep export projection testable, preserve the existing timetable semantics and generate deterministic printable geometry independently of browser layout.

**Non-Goals:** Backend PDF rendering, database changes, a shared generic reporting framework, configurable layouts or redesigning the live timetable grids.

## Decisions

### Reuse saved data and existing projections

Project an immutable snapshot of `data.dataset`, never the draft-derived `displayed` dataset or search-filtered grids. Extend the lesson/cell types to preserve room data and reuse buildTeacherTimetables for ordering, eligibility and partner derivation. Overlay saved reception details; omit substitution-specific disabled flags from this general-purpose export. Resolve partner names from the snapshot teacher catalog. Keep full displayed names, including customized names.

Using the existing response avoids a redundant export endpoint and divergent date/override logic. Printing the DOM was considered but would couple output to tooltips, filters and responsive styles.

### Dedicated fixed-geometry renderer

Add a small timetable export projection and dedicated jsPDF renderer alongside the existing substitution export files. Use A4 landscape (297 x 210 mm), two equally sized grid blocks, five equal day columns, a narrower hour-header column and seven equal body rows. Reserve predictable space for page context, legend and teacher headings. The final odd grid retains the same geometry.

Wrap and measure every cell before producing the downloadable result. Start with a readable body font, allowing a bounded reduction to a documented minimum of 7 pt. Validate the worst-content fixture visually; never reduce below the minimum, clip text, expand individual rows or silently drop partner names. If the complete content cannot fit, show an error identifying teacher and slot so the user can review the source content. This keeps the agreed format deterministic without pretending arbitrary amounts of text can fit.

### Compact colored content

Use light blue for lessons, amber for other activities and green for receptions, with dark text and a repeated legend. An overlapping reception adds a green stripe to the activity cell. Keep content as PDF text operators for selection and extraction. Render class/activity first, room and campus next, followed by compresenza names and any reception details. Do not print substitution availability flags. Omit unavailable room/campus data for activity-code cells and receptions; retain explicit missing-location markers for ordinary lessons. Repeat a concise legend at the top of every page, using only needed activity/annotation explanations. Show selected date separately from timetable version effective date and add page numbering.

### Small Orari download control

Add a clearly labeled “Scarica PDF completo” action near date/search controls. Disable it during loading, editing, empty data or generation, with an explanation for unsaved drafts. Use a dated filename such as `orari-2026-10-21.pdf`. Generate from a stable snapshot; discard stale output after a date/data change and release temporary object URLs. Surface generation errors accessibly. No preview workflow or format options are required.

## Risks / Trade-offs

- Dense compresenze or long reception details exceed two-grid capacity → measure before download, wrap, use bounded font sizing and report an explicit failure if needed.
- Missing room or campus values → print explicit unknown markers; do not infer or invent rooms.
- Changes to shared types affect existing timetable consumers → preserve current screen rendering and run related timetable tests.
- Existing uncommitted work touches Orari → apply narrowly and preserve unrelated changes.

## Migration Plan

No data migration is needed. Verify using synthetic data and an isolated temporary database through standalone compose.testing.yaml with a unique project and allocated port; confirm its mount and testing environment before behavioral actions. Render and inspect a sample PDF. Tear down only that test project. When deployment is authorized, rebuild and recreate normal service as documented in AGENTS.md, verifying its production data mount and served asset hash with read-only checks. Rollback reverts feature code and rebuilds the image; stored data is unaffected. Ask before committing.
