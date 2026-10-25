# Design

## Context

Settings currently composes TimetableImport inside a dataset wrapper, followed by HourTypes, ReceptionImport, SheetsSettings and BackupSection. JSON archive controls and the theme button share a small action row. HourTypes and SheetsSettings have different card padding and radii, reception controls use a separate flex layout, and BackupSection has extensive inline styling, including its confirmation overlay. Existing app colors are already centralized as `--bg`, `--pan`, `--ink`, `--mute`, `--line`, `--acc`, `--on` and `--soft`.

Native details/summary already appear in import previews, reception history and integration help. Existing workflow components own their local form/preview state; conditional mounting would discard it. Frontend tests use a lightweight React hook harness and assert import confirmation behavior. A broad mobile selector currently hides `thead th:last-child`, so Settings tables need scoped rules that preserve their columns. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** One Settings visual system covering containers and contents, a small reusable disclosure component, existing functional boundaries, and easy future restyling with documented classes and tokens.

**Non-Goals:** New settings features, a global app redesign, a new component library or dependency, backend/API changes, changes to persistence semantics, or moving workflow configuration out of Settings. Accordion state need not persist across navigation or reload; a fresh visit starts collapsed.

## Decisions

### One page composition with five reusable disclosures

Introduce a small SettingsGroup component using native details/summary, without the shared-name attribute that would force single-open behavior. Its interface supplies a title, description, summary status and children. Keep children mounted while closed, using native visibility and keyboard exclusion. This preserves selected files, drafts and previews and needs less custom keyboard logic than a bespoke accordion. Do not conditionally render workflow bodies based on open state or key them by background status.

Organize the page in the agreed order:

| Group | Contents | Example summary |
| --- | --- | --- |
| Orari e ricevimenti | Separate Orario and Ricevimenti subsections; timetable counts, anomalies and reception versions | Teacher/class counts and reception count |
| Regole supplenze | Existing hour-type policy table | Number of configured types |
| Collegamenti | Google Forms configuration, credentials, test and synchronization details | Configured/not configured and sync status |
| Dati e backup | Separate JSON archive and database backup subsections | Backup count and latest backup date |
| Aspetto | Existing light/dark control | Current appearance |

Use existing API responses and small callbacks from workflow owners to update summary metadata. Avoid a second polling or settings data layer. Header summaries remain text/status, with interactive operations inside the body so buttons are not nested in disclosure triggers. Show loading or unavailable text honestly; a failed summary must not block access. Error indicators can identify a closed group with a workflow failure without forcing it open.

### Shared compact styles, scoped to Settings

Create a dedicated Settings stylesheet imported once by the page, separating this system from the accumulated general stylesheet. Define a compact scale on `.settings` for section gap, body padding, row gap, control padding, control height, radius and form width, using existing app color and font tokens. Illustrative defaults are 12px body padding, 8px row gaps, 6px/8px control padding and 4px control radii; confirm density visually against the existing app rather than introducing a new aesthetic. Keep interactive targets at least 44px through row/label hit areas where the visible control is smaller.

Use shared semantic classes such as `settings-group`, `settings-subsection`, `settings-form`, `settings-field`, `settings-actions`, `settings-button` with primary/secondary/danger variants, `settings-notice` with status/error variants, `settings-table`, `settings-list` and `settings-muted`. Component-specific classes remain only for distinct behavior such as reception matching columns, not their own button or form skins. Remove obsolete Settings CSS rather than appending override layers. Shared selectors remain scoped under `.settings` to avoid changing Supplenze, Orari, Inbox or other screens.

No inline presentation CSS is allowed in the Settings composition or its rendered workflows. Replace backup hardcoded colors, fallback surfaces, margins, list styles and modal layout with classes and app-derived tokens. Do not introduce extra nested cards; group bodies use subsection headings and separators with one hierarchy. Document which shared class each future setting group should use, including a short example and token map.

### Normalize all workflow contents

Retain Orario and Ricevimenti as distinct forms under one group, with the same field widths, label spacing, file-picker treatment, action order and preview surface. Keep previews and histories visually subordinate, with consistent disclosures for verbose details. Preserve the reception matching table and optional campus behavior.

Move JSON export/import from the dataset action row to Dati e backup and move theme selection to Aspetto. Restyle policy rows, integration fields and backup lists using the same controls and density rules. Remove redundant group titles from embedded components while keeping meaningful subsection labels and accessible regions. Keep local save behavior explicit: hour-type toggles still autosave, integration settings still have Save, and disclosure changes never imply persistence.

Standardize local notices using role=status for progress/success and role=alert for failures. Retain messages and input on failure, and keep labels attached to controls. Constrain wide preview tables inside their own scroll containers; reset or scope the global mobile table-header hiding rule so meaningful Settings columns remain available. Long backup filenames and imported teacher names wrap rather than widening the page.

### Use one explicit confirmation pattern

Reuse the app's existing native `window.confirm` pattern for final Settings operations requiring confirmation. Timetable and reception imports already use it; JSON restore also uses it. Replace the custom inline-styled backup overlay with the same pattern, naming the backup and retaining its warning about overwriting current data. This removes a separate dialog skin and custom focus burden while preserving backend confirmation and preview/token safeguards. Inline preview stages remain visible before the final confirmation. No confirmation is added to ordinary disclosure or theme actions.

## Risks / Trade-offs

- Mounted hidden components still fetch existing status → retain current behavior and reuse their results for summaries rather than creating duplicate subscriptions.
- Extracting Settings or changing wrappers can reset state accidentally → test collapse/reopen with selected files, manual matching and reviewed previews; keep workflow identity stable during refresh.
- CSS removal can affect reused components outside Settings → inspect callers and retain shared non-Settings rules; scope Settings-specific changes and verify other screens visually.
- Compact tables can hide actions on mobile → contained scrolling, wrapping and explicit tests for the existing last-column selector.
- Header statuses can become stale after actions → update them from successful workflow responses, including imports, policy saves, backup creation and restores; failures show unavailable/error states without clearing drafts.
- Native confirmations have browser-provided appearance → accept this existing app convention for consistency and accessibility rather than maintaining another custom modal system.

## Migration Plan

1. Implement frontend composition and shared styling without backend or data migrations.
2. Run focused regression tests for disclosure state, imports, restores and unchanged policy/integration save behavior; document the styling contract alongside the change.
3. Build and recreate a uniquely named standalone testing Compose project with an isolated temporary database. Verify mount, allocated port, testing API and red ribbon before behavioral checks. Review all groups in both themes at desktop and narrow widths, then stop only that test project.
4. Rebuild and recreate the normal service using `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate`. Verify its project data mount, non-testing environment and updated served frontend with read-only checks. This is part of finishing the implementation, not an optional follow-up.
5. Rollback consists of redeploying the preceding frontend version; no database rollback is required for this presentation change. Ask before committing completed work.
