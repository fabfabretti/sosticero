# Tasks

## 1. Teacher identity and administrative APIs

- [x] 1.1 Add idempotent teacher-account/session schema initialization to the protected identity store, with stable person linkage, normalized unique email and revisions; verify migration preserves office identities and operational data, import remains inert, and school archives exclude login data.
- [x] 1.2 Implement admin-only teacher access listing and atomic batch email/status updates, validating people, duplicate normalized emails, activation prerequisites and revisions; verify direct non-admin denial, conflicting batches with no partial writes, and unchanged staffing records.
- [x] 1.3 Implement explicit eight-digit PIN issuance/reset using cryptographic generation and existing adaptive hashing, returning plaintext once and revoking sessions; verify leading zeros, non-retrievability, unchanged enabled status and safe explicit retry after a lost response.
- [x] 1.4 Document administrator setup, email normalization, manual PIN distribution and recovery in docs/gestione-docenti.md; verify the documented setup sequence matches the implemented endpoints and activation prerequisites.

## 2. Teacher authentication boundary

- [x] 2.1 Implement dedicated teacher login/session/logout with separate cookie and typed principal, twelve-hour expiry, rotation, origin/CSRF protections and HTTPS cookie settings; verify expiry, logout replay and coexistence with office sessions.
- [x] 2.2 Add generic credential failures, dummy hash checks and bounded per-identifier/per-source temporary limits; verify unknown/disabled/wrong-PIN failures, leading-zero login, distributed attempts, cross-identifier attempts and expiry/cleanup of limits.
- [x] 2.3 Enforce an explicit teacher route allowlist and atomic revocation on email/PIN/status changes; verify teachers cannot access operational day data, full Orari, staffing, administration, exports, attachments or mutations, and unresolved personal links fail closed.
- [x] 2.4 Document teacher session scope, rate-limit defaults and trusted HTTPS/origin deployment requirements in docs/server-deployment.md; verify existing office authentication regression tests pass.

## 3. Personal timetable API

- [x] 3.1 Add the session-owned date-validated personal timetable projection using existing effective timetable, override and appointment resolution; verify own lessons/activities/classes/rooms/campuses and dates before/during/after successive replacements, including POT exclusion.
- [x] 3.2 Enforce minimal no-store responses and disallow client selection of other teachers; verify payloads contain no colleague catalogs, staffing evidence or operational records, and distinguish missing timetable, unresolved identity, weekends and valid empty days.

## 4. Administration interface

- [x] 4.1 Extend the existing Docenti tab with inline email/access columns, search, Senza email, natural Tab navigation and one batch-save action; verify creation and Assenze prolungate remain functional and pending edits survive filtering, failed saves and conflicts.
- [x] 4.2 Add unsaved-navigation handling and generate/reset PIN controls with explicit reset confirmation and one-time copyable display; verify keyboard accessibility, reveal cleanup, activation prerequisites and no browser persistence of PINs.
- [x] 4.3 Update the administrator guide with the final table workflow and reset behavior; verify responsive table usability and run administration/staffing frontend regression tests.

## 5. Teacher portal interface

- [x] 5.1 Add the dedicated teacher entry, email/PIN login and isolated session bootstrap using existing UI tokens and loading/error patterns; verify generic errors, numeric-friendly masked PIN entry, office-entry compatibility and absence of teacher directories or office background requests.
- [x] 5.2 Implement Il mio orario with Europe/Rome today, previous/next date, date picker, Oggi, personal identity and logout; verify desktop/mobile layouts, empty/error/loading states, accessible labels and correct class/room/site/activity rendering.
- [x] 5.3 Add quiet refresh and protection against stale date/identity responses; verify logout, expiry and account switching clear private content, date changes cannot render earlier responses, and session failures require explicit login.
- [x] 5.4 Document the teacher URL, timetable-only scope and administrator reset instructions; verify frontend type checks/build and focused portal interaction tests pass.

## 6. Isolated integration and deployment

- [x] 6.1 Run relevant backend/frontend suites and an isolated container check using compose.testing.yaml, unique TEST_PROJECT, mktemp TEST_DATA_DIR and the prescribed LOCAL_UID/LOCAL_GID up command; inspect mounts/allocated port, verify testing environment and ribbon before mutations, then exercise multi-teacher isolation, batch setup, login, date browsing and reset/revocation without touching operational data.
- [x] 6.2 Deploy the verified feature with ./scripts/deploy.sh and perform read-only release/environment/health/asset checks on atlante; record the result and stop only this task's test project, leaving the old local operational app stopped.

## 7. First-release UX corrections

- [x] 7.1 Add atomic individual/bulk activation with missing-PIN generation and preserved existing credentials; verify access, concurrency and revocation tests.
- [x] 7.2 Replace staged activation with separate email mode, persistent save controls, selections, immediate actions and retained PIN distribution; verify interaction tests and browser desktop/mobile flows.
- [x] 7.3 Improve login entry styling and pasted/visible PIN handling; document and verify the login predicates without changing production credentials.
- [x] 7.4 Run isolated integration, deploy with ./scripts/deploy.sh, verify the release read-only and stop the owned test project.

## Workflow follow-up

- Ask the user whether to commit the completed work before making any commit.
- Archive only after implementation and the requested review workflow are complete.
