# Tasks

## 1. Identity storage and local account commands

- [x] 1.1 Add an explicit-path identity store and pinned maintained Argon2id hashing without import-time effects; test additive initialization, hash verification and failure-closed startup with temporary stores and unchanged school records.
- [x] 1.2 Add hidden-prompt initialize/create/list/reset/rename/enable/disable/sede-change commands with no administrator role or hardcoded credentials; test username/sede validation, session revocation and absence of secrets in arguments/output.
- [x] 1.3 Document the actual account bootstrap, maintenance and separate identity-recovery commands in README during implementation; verify examples against isolated stores and describe username versus display name and filesystem administration requirements.

## 2. Sessions and authenticated request boundaries

- [x] 2.1 Add login/logout/current-session with hashed opaque tokens, 12-hour expiry and bounded expiring login-attempt limits; test generic failures, rotation, expiration, logout and account-change revocation.
- [x] 2.2 Add explicit trusted-origin/Host policy, CSRF protection and HTTP/HTTPS cookie modes; test current localhost and random testing ports, Secure cookies in HTTPS mode, missing/foreign origin/token rejection and no arbitrary proxy trust.
- [x] 2.3 Authenticate all operational routes including attachments, direct fetch callers, exports and credential uploads, using a small explicit public allowlist; verify anonymous denial for every operational route and migrate test fixtures to authenticated clients.
- [x] 2.4 Document localhost-only HTTP limitations, session behavior, reauthentication and actual deployment configuration in README; verify no default Compose bind, mount or operational database change is introduced.

## 3. Sede and shared-workflow permissions

- [x] 3.1 Implement a complete route/action matrix: all-school reads, shared everyday edits and Orari edits/exports, Centrale-only Settings actions and no web account-management role; test both accounts against every classified endpoint and document the matrix in README.
- [x] 3.2 Derive assignment campus from current server row or preserved orphan context inside the transaction; test assignment/removal/Comunicato/conflict moves, unknown campus, stale campus and direct cross-sede API attempts without trusting client filters.
- [x] 3.3 Verify an eligible other-sede teacher can cover an authorized row and retain global booking/travel/recupero checks; add two-account races and confirm neither account acquires both-campus assignment permission through shared Orari editing.

## 4. Topbar identity and visible restrictions

- [x] 4.1 Add right-aligned display name/sede and logout in the existing topbar with responsive wrapping; verify long names, narrow screens, keyboard access and all existing navigation destinations.
- [x] 4.2 Keep other-sede rows/candidates inspectable while blocking save/removal/move/Comunicato with a prohibited cursor and accessible owning-sede explanation; verify mouse, keyboard and touch actions never submit unauthorized mutations.
- [x] 4.3 Keep Settings visible but shared configuration read-only for Succursale; retain usable theme and operational exports for both accounts, and verify browser-local theme/filter values persist independently and never change server permissions.
- [x] 4.4 Add session discovery and 401/403 handling to shared/direct API clients, uploads and attachments; verify deep links, expired-session input/scroll retention, paused polls, explicit retry and clearing prior-account inputs on logout/account switching.

## 5. Shared Orari and configuration concurrency

- [x] 5.1 Retain per-teacher name preconditions and atomic timetable basis/preview checks for both accounts; test competing names/overrides/deletions, changed reviewed impact, assignment preservation and review flags.
- [x] 5.2 Scope timetable/reception/override preview fingerprints to relevant dependencies; test that Inbox polling status/count changes do not expire previews while impactful absence/assignment/timetable changes still require review.
- [x] 5.3 Add 15-second non-overlapping Orari/shared Settings polling and visibility-return updates using existing quiet-refresh behavior; verify selected teacher/date, scroll/focus, open disclosures, timetable edits, selected files and previews are preserved with deferred snapshots.
- [x] 5.4 Add per-record preconditions for shared Settings publications by concurrent Centrale sessions, including hour-type fields and connection/credential state; test stale same-record changes and independent types, plus old connection-test/sync responses after reconfiguration.
- [x] 5.5 Document shared Orari concurrency, conservative timetable-basis conflicts, quiet refresh, Centrale-only configuration and browser-local preferences in README; verify the documentation matches implemented conflict and refresh behavior.

- [x] 5.6 Add nullable Inbox acceptor identifier/username/display-name snapshots through an additive migration and capture them from the authenticated session in the acceptance transaction; test rollback, forged payloads, concurrent/repeated acceptance retaining the first acceptor, and legacy items without attribution.
- [x] 5.7 Show the acceptor and processing time in Cronologia and already-processed outcomes; test historical names survive account rename/disablement and operational backup/restore, and document the behavior and legacy fallback in README during implementation.

## 6. Global publication, worker and restore coordination

- [x] 6.1 Add one cross-process/thread write gate with a fixed lock order shared by protected writes, local account changes and Inbox publications; test lock timeout/failure cleanup, revocation races and absence of deadlock during simultaneous service/administration work.
- [x] 6.2 Persist an operational generation outside the restorable database and attach it to mutable reads/previews/writes without refreshing retained editor baselines silently; test old queued writes, identical-content restoration, ordinary-edit independence and crash/failure-safe publication invalidation.
- [x] 6.3 Coordinate Centrale timetable/reception/JSON publication and backup restoration with in-flight writes, existing confirmation/preview validation and pre-publication backups; test both commit orders, stale browser generations and atomic failure behavior with temporary databases.
- [x] 6.4 Coordinate Inbox worker publication and configuration reload around global changes/restore; test a worker fetch crossing restoration cannot republish obsolete state or use replaced connection configuration.
- [x] 6.5 Preserve the separate identity store across legacy operational restores and exclude it from portable school-data artifacts; test passwords/sede/disabled status, session invalidation, fresh-machine fail-closed behavior and restore failure cleanup.
- [x] 6.6 Document import/restore coordination, explicit reload after generation changes, separate identity backup/recovery and remaining deployment limits in README; verify actual commands and failure messages against isolated examples.

## 7. Isolated integration and deployment

- [x] 7.1 Run authenticated backend/frontend suites, build and strict OpenSpec validation; verify prior operational tests still check their business behavior and all database mutations use temporary test stores.
- [x] 7.2 Build a uniquely named standalone compose.testing.yaml project with mktemp data; inspect mounts/allocated port, testing=true and TESTING ribbon before creating synthetic accounts/data, then verify two-client login, all-school visibility, assignment restrictions and shared Orari/Inbox/permit races.
- [x] 7.3 Verify in real browsers topbar identity, blocked cursor and keyboard/touch explanations, local preference independence, read-only Succursale Settings and quiet-update scroll/focus/editor retention; verify publication/restore barriers and expired-session behavior, then stop only this test project.
- [x] 7.4 Bootstrap intended accounts explicitly for rollout without modifying school records; rebuild/recreate normal Compose service as required by AGENTS.md and verify operational mount/database, production environment and updated frontend using read-only checks. Report any failure and database in use.

## Workflow follow-up

- README documentation is written together with implementation, not during this proposal revision.
- Ask whether to commit before committing; do not include unrelated existing changes.
- Archive after implementation and verification are complete and reviewed.
