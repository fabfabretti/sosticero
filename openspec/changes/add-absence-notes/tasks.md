# Tasks

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
