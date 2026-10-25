# Tasks

## 1. Shared Settings structure and styling

- [x] 1.1 Add the reusable native SettingsGroup disclosure and compose the five agreed groups, initially closed and independently expandable; verify frontend tests cover group order, keyboard semantics, preserved Settings URL/footer and no writes on toggle.
- [x] 1.2 Add the centralized Settings stylesheet with app-derived tokens and shared field, action, button, notice, table and list classes; remove replaced outer card styles and document the token/class extension contract. Verify representative equivalent controls share classes and no Settings workflow retains inline presentation CSS.
- [x] 1.3 Add read-only header summaries using existing workflow responses and callbacks; verify loading/error states do not prevent opening groups, successful actions update summaries, and status refreshes preserve drafts, expansion and focus.

## 2. Normalize existing workflows

- [x] 2.1 Restyle Orario and Ricevimenti as separate compact subsections using shared form, file, action, preview and disclosure patterns; verify import tests retain preview/token/confirmation behavior, uncertain teacher selection and optional campus handling, including file/matches/preview preservation across collapse and reopen.
- [x] 2.2 Restyle hour-type rows and Google Forms configuration with the shared fields, notices and action hierarchy; verify toggle autosave, explicit integration save/test, local error retention and no writes caused by accordion changes. Update user documentation for the new locations.
- [x] 2.3 Move JSON export/import and database backups into distinct Dati e backup subsections; replace backup inline styles and custom overlay with shared classes and native explicit confirmation. Verify export, cancelled restore, failed restore and successful restore paths retain existing safeguards and identify the archive/backup target.
- [x] 2.4 Move appearance controls into Aspetto and bind its summary to the selected appearance; verify theme changes update the page consistently without changing other settings or remounting in-progress workflow state.

## 3. Responsive and visual verification

- [x] 3.1 Scope conflicting global mobile table rules and apply shared wrapping/contained scrolling to previews, policy rows and backup filenames; verify all meaningful columns and actions remain available, no page-wide overflow occurs and focus remains visible at narrow and desktop widths.
- [x] 3.2 Run focused workflow tests, the frontend regression suite and production build; visually review all collapsed/open groups in both themes in an isolated standalone testing Compose project with a unique name, mktemp database and allocated localhost port. Verify mount, testing API and ribbon before mutations; record screenshots and state-preservation results, then stop only that project.

## 4. Normal deployment

- [x] 4.1 Rebuild and recreate the normal service using LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate; verify the project data mount, testing=false and new served frontend hash with read-only checks, and record deployment evidence without importing or changing production settings.

## Workflow follow-up

- Ask whether the user wants to commit the completed work before committing it.
- Archive the change only after implementation and review are complete and the user requests archiving.

## Repository reconciliation — 2026-10-25

Settings and the shared operational UI styles are committed with the coupled entry-dialog integration. The settings-page main specification is synchronized. The final frontend passes all 16 test files and its production build. Earlier container/browser evidence above remains historical; no server deployment was performed during repository reconciliation.
