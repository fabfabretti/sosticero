# Tasks

Sections 1–3 record the completed original delivery. Sections 4–5 track the approved follow-up; all new container checks use the standalone testing deployment described in section 5.

## 1. Persist source notes

- [x] 1.1 Add absenceNotes/permitNotes defaults, load normalization, strict optional API note fields and response types; verify isolated tests cover missing metadata, literal strings, blank/null clearing, invalid types and rejection on class/availability entries.
- [x] 1.2 Implement source-aware preservation, deletion and valid permit moves in existing transactions; verify backend tests cover omitted-note hour edits, independent source removal, moves, and rejected protected edits retaining original notes and recovery links.
- [x] 1.3 Extend archive validation and portability; verify tests cover legacy imports, note round trips, database backup restoration, invalid types and orphan metadata rejecting import atomically.

## 2. Edit and display notes

- [x] 2.1 Add the manual absence note draft and explicit save control to the existing ⋯ editor; verify UI tests cover save, clear, failed-save draft retention and date/source switches without changing classification or hours.
- [x] 2.2 Add the optional note field to dated permit creation/editing; verify UI tests cover loading, saving, clearing and resetting drafts after successful save/cancel, including permit-only daily rows.
- [x] 2.3 Compose one daily (i) tooltip with existing permit information and labelled source notes; verify sidebar tests cover both notes, each source alone, no-note permit information, keyboard focus, escaped markup and long-text wrapping/scrolling at desktop and narrow widths.
- [x] 2.4 Document note entry locations and hover/focus reading in README.md; verify the instructions match the delivered controls.

## 3. Integration and deployment verification

- [x] 3.1 Run the relevant backend suite and frontend checks; rebuild and force-recreate the app with LOCAL_UID/LOCAL_GID and an explicitly selected temporary Compose override replacing /data, verify the isolated mount before writes, and check note editing/display through reload and permit moves.
- [x] 3.2 Restore the normal deployment with LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate; verify /data mounts the project's data directory and the frontend serves the updated asset hash using read-only checks.

## 4. Complete note entry and table visibility

- [x] 4.1 Add an independent Note draft to the Supplenze add-teacher form and include it in initial manual absence saves; verify UI tests cover immediate (i) visibility, success/date/source reset, failed-save retention and omission for classes/availability.
- [x] 4.2 Persist manualPermitNotes with strict optional ManualPermit input, explicit register response data, source cleanup and archive validation; verify isolated backend tests cover creation, omission-preserves hour edits, clearing, deletion, protected edits, unchanged recovery identities/links, legacy loading, round trips, backup restoration and atomic invalid-type/orphan rejection.
- [x] 4.3 Make the Note field available in both initial Permessi form modes and saved-record editing, including loading manual balance notes; verify UI tests cover visibility before/after teacher selection, endpoint payloads, failed-save drafts and reset after success/cancel/mode switches, and diagnose the reported dated-field visibility in the freshly built app.
- [x] 4.4 Add note (i) tooltips beside teacher names in both dated and manual balance tables; verify UI tests cover correct per-record content, blank-note icon removal, hover/focus, literal markup, long-text scrolling and unchanged independent warning icons.
- [x] 4.5 Tighten both Permessi tables with scoped padding/gaps, inline warnings and compact accessible actions; verify desktop/narrow screenshots show shorter ordinary rows, no unused warning strip, all columns and sorting, readable text/focus, and complete multiline recovery details.
- [x] 4.6 Update README instructions for all three creation flows and both table note tooltips; verify the documented labels and reset behavior match delivered controls.

## 5. Follow-up integration and deployment

- [x] 5.1 Run backend/frontend suites and build, then verify all creation/editing paths, reload persistence, note tooltips and compact tables in a unique standalone compose.testing.yaml project with isolated TEST_DATA_DIR and allocated port; verify the mount and testing:true/ribbon before writes, capture desktop/narrow results and stop only that project.
- [x] 5.2 Rebuild and force-recreate normal service for the approved implementation; verify the operational /data mount, testing:false and served asset hash with read-only checks, leaving operational records unchanged.
