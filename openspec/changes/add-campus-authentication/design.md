# Design

## Context

See proposal.md for motivation. The single-process FastAPI service serves React and SQLite through the existing loopback Compose binding. `harden-shared-edit-concurrency` is implemented: operational record tokens, transactional checks, 15-second quiet Supplenze/Permessi refresh and idempotent Inbox processing. Inbox polls every 30 seconds. Orari already compares prior teacher-name values, validates timetable basis, previews impacts and rechecks preview tokens inside write transactions. Some preview fingerprints include every JSON document, including irrelevant Inbox polling state. Settings hour-type controls submit three fields together without a displayed-record precondition. Theme/filter preferences are browser-side; preserve that distinction.

## Goals / Non-Goals

**Goals:** Apply the explicit access matrix, preserve all-school visibility and existing editing interactions, make shared Orari and configuration use safe, and keep identity stable across operational restore.

**Non-Goals:** Administrator web roles, account-management screens, hardcoded credentials, signup/email recovery, OAuth/MFA, collaborative text merging, certificate provisioning or opening the service to other computers. Existing Orari editors stay as they are; no new draft system is introduced.

## Decisions

### Permission matrix is based on the account sede

| Resource/action | Centrale account | Succursale account |
| --- | --- | --- |
| All pages, both campuses, teacher profiles, candidates, statistics, operational attachments | Read | Read |
| Assignment create/change/remove, Comunicato, conflict reassignment | Centrale rows only | Succursale rows only |
| Assenze, classi fuori, disponibilità, dated permessi, manual balances | Shared editing | Shared editing |
| Inbox accept/ignore, including teacher resolution and review metadata | Shared editing | Shared editing |
| Orari teacher names and manual timetable overrides, including deletion/reset | Shared editing | Shared editing |
| Existing operational/PDF exports from Supplenze and Orari | Allowed | Allowed |
| Settings hour-type policies and Google connection/credentials/test actions | Read/write | Read-only |
| Settings timetable/reception imports, JSON archive import/export, backup list/create/restore | Allowed | Read-only list/status; no action/download of Settings archives |
| Theme and campus view preference | Browser-local | Browser-local |
| Account creation/reset/disable/display-name/sede changes | Local administration command | Local administration command |

Account administration requires filesystem/shell access to the identity store, not an application account role. A Centrale login does not grant account-management powers. Settings read responses expose configured status, not secrets; Google private keys are never returned to either account. Manual timetable editing belongs to Orari and remains shared, even though importing a new timetable belongs to Settings and is Centrale-only. Existing Settings sections remain visible to Succursale with read-only controls and a short explanation; its theme control stays usable. Build and test an explicit route policy table with default denial for unclassified operational endpoints.

### Persist accounts, administer locally

Use a separate explicitly selected identity SQLite database, default `/data/auth.sqlite`. Accounts have a unique normalized username, independent display name, one of the two sede values, enabled status and an Argon2id password hash. No administrator role or password literal is shipped. Use a pinned maintained hashing package, bounded password input and dummy verification for nonexistent usernames; never log credentials.

Provide hidden-prompt local commands to initialize the identity store, create accounts for either sede, list nonsecret account metadata, reset passwords, rename accounts, change sede and disable accounts. Passwords are never arguments or environment configuration. Run bootstrap explicitly before exposing authenticated service; an empty/unavailable identity store fails closed without opening operational data publicly. Account commands take explicit paths and retain test/production isolation safeguards. Normal module imports perform no initialization. Password, enabled-state or sede changes revoke that account's sessions. Reenabling an account does not resurrect them. No passwords or user names are hardcoded; the first installation can create accounts with display names Centrale and Succursale.

### Sessions and current account

Use opaque random session tokens in HttpOnly, SameSite=Lax, Path=/ cookies; store only token hashes, account reference and expiry in the identity database. Rotate on login, expire after 12 hours and revoke on logout. Successful session discovery returns the display name, username, sede, CSRF token and current operational generation, never password hashes. Rate-limit login by normalized username and address using bounded expiring counters, generic error messages and temporary throttling.

Require configured-origin/Host validation and session-bound CSRF tokens on authenticated unsafe requests; protect login/logout too. Keep CORS closed and do not trust arbitrary forwarded headers. Explicitly permit the current loopback HTTP origin with non-Secure cookies; HTTPS mode sets Secure. Random localhost test ports remain supported through explicit test configuration. Do not change Compose's bind, mount or operational database default. HTTP to a remote machine is not made safe by having a login screen and is not enabled here.

### Enforce assignment permissions inside the save transaction

Resolve effective row campus from current server data, alongside the existing concurrency check. Never use the browser filter, submitted campus or the candidate teacher's usual campus to authorize an action. A Centrale operator may assign an eligible Succursale teacher to a Centrale row; existing global availability/travel/recupero rules still apply. Check all actions, including clearing, Comunicato and conflict source/destination moves. A move touching two different campuses cannot be done by one account: the authorized source operator can remove it and the destination operator can assign it separately.

For an orphaned assignment use its preserved server-side campus context. If campus remains unknown, neither account can mutate that assignment until its context is resolved through the shared Orari workflow; do not invent an administrator bypass. Return a clear reason. A changed campus may produce 403; a stale record may produce 409, and neither changes data.

Keep both-campus rows visible under existing view filters. Their cells can open candidates for inspection, but saving, removal, reassignment and Comunicato are unavailable outside the account's campus. Use `aria-disabled` plus handler guards where focus is needed for explanation, `cursor: not-allowed`, and an associated visible/accessible message. Do not rely on hover or color alone: keyboard and touch users receive the same reason. The candidate list explains that the row belongs to the other sede; teacher names and details are not hidden or globally disabled.

### Show identity without interrupting the shell

Put display name and sede at the right of the topbar, followed by logout; allow wrapping on narrow screens without hiding navigation or identity. Gate initial data reads on session discovery. For expiration, keep existing mounted inputs and editors while an accessible login layer blocks operational interaction. Preserve scroll/focus and return to the requested route. Pause background polls while unauthenticated, distinguish 401 from 403, and never automatically replay writes after login. Preserve retained inputs only when the same account reauthenticates. Explicit logout clears the previous account's retained editors; if a different account logs in after expiration, clear the earlier account's retained inputs before rendering operational content. Every save rechecks the current account's permissions.

### Reuse concurrency checks and extend quiet reads

Keep assenze/permessi/Inbox protections unchanged. Add non-overlapping 15-second Orari and shared Settings refresh, plus visibility-return refresh. Preserve selected teacher/date, filters, local theme, scroll, focus, disclosures, selected files and import previews. Hold the latest remote snapshot during active editing rather than remounting/resetting controls. After an actual conflict, keep entered work, explain current saved state, and require deliberate reconciliation; never attach a newer baseline to unchanged older inputs.

Teacher-name changes retain the existing per-teacher previous-value check. Orari edits retain timetable basis and atomic impact-preview checks: a real timetable publication or another override can invalidate an open timetable basis. This conservative restriction is acceptable initially because timetable changes share constraints; record it in README. Inbox status/count changes must not invalidate an Orari/import preview. Fingerprint only actual timetable, policy and operational dependencies used by impact calculation, and revalidate inside the commit transaction. A new absence or assignment that changes the previewed impact requires a new preview; it never silently replaces the earlier reviewed impact. Existing assignments survive timetable changes and are flagged for review where necessary.

Add per-hour-type/configuration-record preconditions for Centrale's shared Settings writes: multiple Centrale sessions can still race. A stale switch cannot replace newer values in the same type; unrelated types do not conflict. Credential uploads/configuration changes must be coordinated with connection tests and syncing so an old request cannot reinstall superseded connection state. Succursale reads the latest shared values but cannot publish any Settings changes. Theme and campus filters remain in localStorage and never enter these server preconditions or refresh payloads.

### Coordinate global publication with current writes and old browsers

Use one shared cross-process file lock beside the identity store for protected writes, local account changes and the Inbox worker's operational writes, always acquired before either SQLite write transaction. Use standard platform file locking (POSIX flock, Windows locking where supported), including coordination among service threads; the lock remains held across commits in both stores. The existing single-writer nature of SQLite makes this a small coordination boundary rather than a new service. Hold the gate for global publication/restore so an in-flight write finishes first or waits; none commits from an obsolete in-flight load after publication. No reverse lock ordering is permitted. Release the gate on success/failure and return an actionable temporary error on timeout.

Store a monotonically increasing operational generation outside the restorable database. Include it in all mutable-view reads and reviewed import previews; clients retain the generation of their displayed baseline, including open editors. Require it on protected operational writes. Increment it on bulk timetable/reception/JSON publication or backup restoration, not on routine record edits, theme changes or backup creation. Queued requests carrying an earlier generation receive a distinct 409 outcome without applying changes, even if restored content happens to hash identically. Never source a retained editor's generation from a global session variable updated by a poll.

Do expensive parsing outside the gate; recompute/check the preview and input generation after acquiring it. Successful publication changes operational state and generation before releasing the gate. Since identity and operational stores are separate, increment generation before attempting publication while holding the gate: if publication fails, old baselines still become stale but operational data remains intact. This fail-safe extra invalidation is preferable to a successfully replaced database with reusable old baselines after a crash. Keep existing explicit confirmation, integrity validation and pre-publication backup behavior. Pause/reload the Inbox worker's effective configuration through this same boundary around restore rather than allowing stale worker results to publish afterward.

### Attribute Inbox acceptance to its authenticated account

Add nullable acceptance-attribution fields to the operational Inbox table using an additive migration: stable account identifier plus snapshots of username and display name at acceptance. Derive them exclusively from the validated server session, never from the submitted review payload. Store attribution in the existing transaction that creates/merges absences and marks the item accepted. A failed acceptance stores neither absence changes nor attribution. Repeated/concurrent acceptance retains the first successful acceptor and processing timestamp; return that saved attribution with the already-processed outcome.

Cronologia shows “Accettata da Maria (username)” alongside the existing processing time. Store name snapshots so account rename, disablement or separate identity-store recovery does not rewrite or erase historical attribution. Existing accepted items display “Accettata · autore non disponibile”; do not invent a historic account or backfill from the current user. Operational SQLite snapshots preserve these nonsecret history fields, including when restored without the original identity store. This addition covers acceptance only; ignored-item attribution and a general edit audit trail are outside scope. Include the behavior and legacy fallback in README during implementation.

### Operational restoration preserves identity

Operational JSON and SQLite backups exclude the identity store, hashes and session credentials. A Centrale restore preserves current accounts, password resets and enabled/sede status, invalidates sessions before protected operations resume, and requires a new data baseline after login. Old operational backups remain usable. A fresh machine needs explicit local identity bootstrap; restoring a school backup alone never enables anonymous access. Account-store backup/recovery is a separate protected filesystem operation, documented during implementation. No identity download endpoint is added.

## Risks / Trade-offs

- Conservative timetable basis checks can reject another concurrent Orari edit -> keep that work and explain the need to reload/reconcile; exclude irrelevant Inbox status from fingerprints.
- A failed global publication can invalidate old baselines -> explain the reload without changing operational records; never replay automatically.
- Two databases require fixed lock ordering and separate identity recovery -> exercise publication/revocation interleavings and document recovery commands.
- HTTP sends credentials without transport encryption -> keep it loopback-only; future network deployment requires configured secure transport.
- Sede permission is not a restriction on all downstream effects -> either operator can change a teacher's shared timetable/absence and affect both sites, deliberately, with existing review flags.
- Unknown-campus assignments have no privileged web bypass -> resolve their timetable/context before editing; test preserved orphan context explicitly.

## Migration Plan

Build on the deployed concurrency change. Add identity schemas without rewriting operational records, extend API fixtures with sessions/CSRF/generation, and bootstrap the two accounts explicitly before enabling authentication. Update README with actual commands and complete behavior during implementation. Test legacy restores, authentication, both sede permissions, shared Orari races, configuration and global generation barriers in temporary databases and a unique standalone testing Compose project. Inspect mount/port, testing=true and TESTING ribbon before mutations; stop only that test project. Then rebuild/recreate normal service as required by AGENTS.md and verify its operational mount, database path and frontend through read-only checks. Ask before committing. Rolling back authentication removes protection; keep the service loopback-only and report any deployment failure and database in use.

## References

- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
