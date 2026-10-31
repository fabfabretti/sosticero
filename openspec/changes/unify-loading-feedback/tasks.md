# Tasks

## 1. Shared presentation and ownership

- [x] 1.1 Add the minimal shared spinner/label and dimmed-region styles, preserving both themes and reduced-motion support; verify rendered status/busy semantics and keyboard protection with a focused component test.
- [x] 1.2 Preserve quiet refresh behavior while exposing or maintaining foreground ownership at callers; add deferred-response tests proving superseded completions cannot apply data or clear newer pending/errors and polling does not interrupt drafts.

## 2. Supplenze and entry workflows

- [ ] 2.1 Retain and dim the previous day's dependent content, guard Add/rows/export immediately by matching loaded context, and keep calendar/navigation/status/retry usable; test rapid A-B-C navigation with reversed responses, failed loads and retry.
- [ ] 2.2 Apply shared feedback and duplicate/stale guards to candidate lookup, consultation, entry edits/removal, assignments, communication flags, conflict reload and related paid/recovery controls; test keyboard activation during pending work and save-success/refresh-failure recovery.
- [ ] 2.3 Add attachment preparation/preview feedback and report pending state to entry, permit and Inbox parents; test that submit waits for reading and replacement/removal/unmount rejects old callbacks, including read failure.

## 3. Registers, timetables and reports

- [ ] 3.1 Standardize Permessi initial load, permit/manual-balance save/delete and explicit reload, preserving form drafts and concurrency handling; verify delayed and failed operations in permit-register tests.
- [ ] 3.2 Standardize Banca ore initial/week load, availability save and explicit reload with retained dimmed data and guarded edit controls; verify week switching and out-of-order responses in paid tests.
- [ ] 3.3 Standardize Orari initial/date/history loads, editing baseline preparation, name changes, override preview/save/delete and PDF feedback; verify stale-result guards and draft preservation in Orari/export tests.
- [ ] 3.4 Retain dimmed Stats and availability results during selection changes, protect CSV/print readiness against mismatched contexts and show accessible retry; test delayed campus/period/week changes and mixed panel readiness.
- [ ] 3.5 Standardize Supplenze PDF generation feedback and current-snapshot guards, ensuring the indicator can paint before expensive synchronous work; verify obsolete result links cannot be used after a scope change.

## 4. Inbox, settings and application entry

- [ ] 4.1 Standardize Inbox initial/pending/history loads, teacher preview, accept/ignore and reload; retain dimmed previous results where applicable and test stale responses, duplicate activation and saved-action reload failure.
- [ ] 4.2 Standardize settings initial sections/summaries, hour-rule saves, connection credential upload/save/test and their recovery paths; verify pending controls and failure recovery in relevant settings tests.
- [ ] 4.3 Standardize timetable/reception file reads, previews, matching checks, confirmed imports and reloads; test replaced file reads, import duplicate prevention and success followed by refresh failure.
- [ ] 4.4 Add archive export/read/preview/restore and backup list/create/restore pending feedback and conflicting-action guards; test operation ownership and refresh failure without repeating restore.
- [ ] 4.5 Standardize initial session/login/logout feedback and public-display first load, preserving quiet session/display/Inbox polling; verify duplicate login/logout protection and existing display freshness behavior.

## 5. Integration and release

- [ ] 5.1 Run frontend tests and production build; verify all paths in design.md's coverage inventory are accounted for, including delayed errors, keyboard access, reduced motion and both themes.
- [ ] 5.2 Start a unique isolated compose.testing.yaml project with a mktemp database directory using the mandated LOCAL_UID/LOCAL_GID up command; inspect mount and allocated localhost port and verify /api/environment testing=true and red TESTING ribbon before changing data. Exercise delayed date navigation, representative saves/imports/attachments and exports, then stop only this test project.
- [ ] 5.3 Deploy the verified feature with ./scripts/deploy.sh and perform read-only atlante release, served asset and mount checks; report release verification and any limitation without behavioral production writes.

## Workflow follow-up

- Ask the user whether to commit before creating any commit.
- Archive only when requested after implementation and review.
