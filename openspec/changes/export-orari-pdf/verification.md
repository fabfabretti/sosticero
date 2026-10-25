# Verification

- Full frontend suite: 14 test files passed. Focused Orari and timetable PDF tests also passed after adding loading/name-draft guards, fixed body-cell geometry and long-name/reception coverage.
- Production TypeScript/Vite build passed locally and in the isolated container image.
- Export projection tested for alphabetical order, all eligible teachers, deduplicated three-way compresenze, room/campus markers, disabled activities and reception-only teachers. Component tests verify unfiltered saved data, dated download name and edit/loading guards.
- PDF tests verify A4 landscape, 1/2/5-teacher pagination, 35 identical body cells per teacher and explicit overflow failure identifying teacher and slot.
- Rendered and inspected a three-page synthetic PDF including long compresenza names, reception overlap and odd final page; no clipped text or overlapping cells observed. Also rendered a page from realistic timetable data.
- Created an isolated database using SQLite online backup into `/tmp/sosticero-orari-mzbw19h_`. Standalone test project `sosticero-orari-mzbw19h_` used its own image and localhost port 39165. Inspected the `/data` mount and confirmed `/api/environment` returned `{"testing":true}`.
- Read selected-date `/api/orari?day=2026-10-21` from the test service: effective date 2026-10-16, nine saved override records. Generated a complete PDF from that resolved response: 154 teachers, 77 pages, no overflow. No operational records were changed.
- Stopped only this test Compose project after verification.

## Remaining browser check

Task 4.2 remains unchecked because the integrated browser rejected both `http://127.0.0.1:39165/orari` and `http://localhost:39165/orari` with `net::ERR_BLOCKED_BY_CLIENT`. The live red ribbon and actual browser-triggered download could not be visually exercised. Component tests cover filtered downloads; API/container checks confirm testing mode. This limitation is not recorded as a successful browser test.

## Implementation notes

Download uses jsPDF's synchronous `save()` rather than retaining an application-level blob URL or preview state. The installed browser save helper creates and revokes its temporary URL. The selected-date equality guard rejects stale loaded data, and no asynchronous generation result can survive a date change. Complete content is measured before a file is offered, with a minimum body size of 7 pt.

## Normal deployment

Rebuilt and force-recreated normal service after isolated verification. Read-only checks confirmed `/data` mounts `/home/fabs/Desktop/sosticero/data`, `/api/environment` returns `{"testing":false}`, and HTML serves the new `index-DtpSTo1h.js` bundle. Only `sosticero_app_1` remains running on port 8000. No commit was made.

## General-purpose PDF correction

User correction supersedes the original disabled-activity presentation: the PDF now omits all substitution availability flags and their legend. Ordinary lessons use light blue, other coded activities amber, receptions green; overlaps retain the activity fill plus a green stripe. Other activities and receptions show only known location components. Missing-location placeholders remain only for ordinary lessons.

Six PDF tests and related Orari/timetable tests pass. New tests cover location omission and actual PDF text operators. External `pdftotext -layout` extraction verified teacher/partner names, room, activity code, reception and both dates in the synthetic PDF. The realistic resolved dataset again exported 154 teachers in 77 pages, with successful text extraction and no availability flags. Visually inspected the colored PDF, including long partner names and reception overlap. These are text/vector PDFs, not rasterized screenshots; no PDF/UA tagging claim is made.

The corrected image built in unique test project `sosticero-orari-colors-1792601273`, with `/data` mounted from `/tmp/sosticero-orari-colors-6GTIvb`, allocated port 40781 and testing=true confirmed before teardown. The previously documented browser-localhost restriction remains. No commit requested or made, per the user's instruction.

Corrected normal deployment was rebuilt and force-recreated. Read-only checks confirmed the operational data mount and new served bundle `index-DUQ4UfR9.js`, with testing=false.

## Repository reconciliation — 2026-10-25

Timetable editing, full PDF export and the matching main timetable-printing specification are committed together. The complete final frontend passes all 16 test files and its TypeScript/Vite build. All 214 backend tests pass after updating the old forced-Centrale DIS assertion to the implemented explicit campus behavior. The pending browser-download check remains unverified; this reconciliation does not claim a new server deployment.
