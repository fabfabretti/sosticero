# Tasks

## 1. Override storage and resolution

- [x] 1.1 Add validated separate override storage, immutable revisions and connected edit groups; test malformed ranges, ordinary/class-linked edits, conservation of activities and unchanged imported datasets using temporary databases.
- [x] 1.2 Extend dated resolution with inclusive bounds, latest-start teacher precedence, same-start revision replacement and reset boundaries; test overlap expiry, future overrides and reset followed by temporary overrides.
- [x] 1.3 Route Orari, daily operations, RP/location checks, statistics and dated exports through effective resolution; add regression tests proving consistent positions and unchanged dates outside intervals.
- [x] 1.4 Document interval precedence and activity-only editing boundaries in README.md; verify examples against resolver tests.

## 2. Preview, apply and eligibility

- [x] 2.1 Add dated Orari metadata and override/reset preview/apply APIs with transactional validation and optimistic tokens; test stale drafts, invalid drops, failures without partial writes and no import-time database side effects.
- [x] 2.2 Enforce disabled commitments before manual availability while preserving visibility and hard restrictions; test normal versus exceptional POT, hidden multi-code activities, explicit confirmation, RP exclusion, absence and double booking.
- [x] 2.3 Extend impact planning and correction evidence to override intervals; test preservation of assignments, permit links and balances, changed-coverage review flags and unchanged unrelated facts.
- [x] 2.4 Document the API and emergency-only semantics; verify documented request shapes against API tests.

## 3. Imports and portability

- [x] 3.1 Extend import preview/apply with compatible edit groups and persistent version-scoped conflicts included in confirmation fingerprints; test changed source, occupied destination, half-swap prevention, unrelated changes, teacher removal and repeated imports.
- [x] 3.2 Implement explicit rebase/discard review for suspended groups; test that incompatible edits do not revive silently and independent compatible edits remain effective.
- [x] 3.3 Extend archive schema and atomic validation to overlays, resets and evidence; test round trips, legacy restoration with retained overrides, invalid references, backup/restore and empty-overlay migration.
- [x] 3.4 Document carry-forward, review and archive compatibility; verify examples with import/archive integration fixtures.

## 4. Orari interface

- [x] 4.1 Replace session chips with compact campus outline/fill rectangles and integrated labels; update frontend tests for class/activity text, C/S/?, inline compresenza, growing rows, campus legend and accessible headers in both themes.
- [x] 4.2 Add view-date selection, per-teacher editing, header date controls, scheduled/active/review badges, saved-override selection and dated reset; test Save/Cancel, invalid ranges, future previews and draft preservation on failure.
- [x] 4.3 Add special-hour drag moves/swaps, click disabling and keyboard equivalents; test invalid targets, campus/status preservation and drag suppression of click toggles.
- [x] 4.4 Add impact confirmation, import compatibility preview and explicit conflict review controls; test stale-save errors, assignment review information and dirty-editor navigation handling.
- [x] 4.5 Update user instructions for editing, dates, emergency availability and reset; verify the described flow against the interface.
- [x] 4.6 Add deletion of saved overrides and same-start revisions, with issue preview, stale-save protection and restored prior schedule; cover backend and UI behavior.

## 5. Integration verification

- [x] 5.1 Run relevant backend/frontend suites and frontend build; verify existing import, candidate, statistics, archive and export behavior passes alongside new override scenarios.
- [x] 5.2 Build/recreate a unique standalone compose.testing.yaml project with isolated mktemp data and explicit project name; inspect mount/allocated port, confirm testing environment and ribbon, then verify pointer/keyboard editing, date expiry, import review and both themes. Stop only this project and leave normal service untouched.

## Workflow follow-up

- Present results and ask whether the user wants to commit before committing any work.
- Deploy to normal service only after approval, rebuilding and recreating compose.yaml; verify the project data mount and new served asset hash read-only.
- Before archival, reconcile the superseded read-only/activity-colour requirements in view-teacher-timetables so archive order cannot restore obsolete behavior; preserve its remaining requirements.
