# Design

## Context

See proposal.md for motivation. `backend/auth.py` owns a separate `auth.sqlite`, Argon2 credentials, sessions and a cross-process gate. Its account schema and session response currently expose one `campus`; middleware distinguishes shared writes from Centrale-only writes. `backend/main.py` additionally checks assignment source/destination campuses and derives publication targets and some author metadata from that single campus. `backend/paid.py` validates campus-only attribution. Inbox already stores account ID/name/username snapshots.

The frontend's Account type, TopBar, Settings read-only flag, assignment controls and Publication component assume exactly one campus. Shell-level Inbox polling is unconditional for authenticated accounts. Existing specs explicitly prescribe local-only account administration and Centrale-owned configuration; the deltas deliberately supersede those choices.

## Goals / Non-Goals

**Goals:** Centralize permission decisions, preserve identity and school records, keep credentials outside school-data archives, and make both/neither campus states explicit throughout backend and frontend.

**Non-Goals:** No external identity provider, arbitrary roles, self-registration, email recovery, account deletion, per-campus data silos or general audit-log service. Existing school-wide operational editing remains shared among operational accounts; campus grants constrain assignments and manual publication.

## Decisions

### 1. Independent grants with a stable protected identity

Extend the identity schema with administrator permission, an explicit set of campus grants, protected status and account revision. Keep `id`, `username`, `name` (labelled Nome completo), password hash and enabled state. Use validated fixed campus values rather than a free-form role engine. A protected marker follows the immutable ID, with uniqueness ensuring one permanent administrator. New protected bootstrap defaults to no operational grants.

Keep local create/list/reset/rename/enable/disable commands, extend them for usernames and permissions, and apply the same protected-account rules as the web service. No hardcoded password, browser setup endpoint or password in CLI arguments. Disabling replaces deletion for all accounts. Username normalization and password/name validation remain server-owned.

Alternative: infer admin from Centrale or reserve a magic username. Rejected because campus and administration are independent, and usernames can change.

### 2. Explicit policy for each route and action

Replace Centrale-only middleware policy with admin policy. Operational routes require a nonempty campus grant set; shared operational changes remain school-wide. Assignment authorization checks membership for every server-derived source/destination campus, preserving existing validation, concurrency and global teacher-booking checks. Unknown campus remains blocked even for administrators.

Classify configuration routes separately from operational routes, including overloaded endpoints: administrator-only imports, backups/full archives, credentials/connection tests, shared rules and publication schedule; operational reads of nonsensitive configuration status remain available. Admin-only accounts may perform administrative imports/previews/restores and see the data those workflows necessarily expose, but cannot browse day data, teacher screens, Inbox items or operational attachments. Admin import previews that require attachment review must use purpose-scoped administrative access, never a blanket operational-read bypass. Server configuration workers remain system operations, independent of browser roles.

Manual publication receives an explicit campus checked against grants. Status also accepts a selected campus. For a single-campus operator select its sole campus; for both-campus operators show an explicit choice using the current permitted view as the initial choice. Never derive publication authority from a client filter.

Alternative: grant admin unrestricted access. Rejected by the dedicated admin-only requirement.

### 3. Account management uses current server identity and revisions

Add administrator-only account list/create/update/password-reset operations. Return only nonsecret metadata, permissions, protected status and revision. Use the existing origin, CSRF and authenticated request mechanisms. Authorize against the current session/account under the existing gate; validate revision and apply each account update atomically. Unique usernames, protection checks and session revocation are server-enforced for local and browser callers.

Credential, permission and enabled-status changes revoke affected sessions. Renames refresh identity through the existing session check (or revoke when required to keep the implementation uniform). An administrator editing their own permissions/password receives explicit feedback and reauthenticates; success must not look like a failed save when the session is revoked. Competing edits return a conflict preserving the draft. Account revisions are separate from school-data publication generation.

### 4. Store authorship as historical account snapshots

Reuse Inbox's `{id, username, name}` identity shape, captured server-side. Inventory author fields: permitCreators, paid availability's createdBy/createdFrom, paid assignments' assignedBy, plus existing Inbox acceptedBy. Convert author representations consistently and update validation, concurrency tokens, import/export, reports, PDFs and labels. Keep target campus in operational context such as paidContext.site; do not reinterpret timetable locations or permission grants as authors.

An existing paid record's createdBy is authoritative. Existing Inbox snapshots stay unchanged. Map campus-only legacy authors only through a persisted, verified mapping to historical account IDs and historical names. Never infer mappings from future grants or substitute the later personal owner of a formerly shared account. Preserve unknown authors with a readable legacy label when mapping is absent/ambiguous. New writes never use permissions as author names. Ordinary record updates preserve the original creator; replacement of an assignment follows its existing creation/replacement semantics.

Portable school data preserves snapshots even if the account is absent locally. Import/restore must not create accounts or resolve foreign IDs to unrelated local users. Legacy normalization must use the same compatibility path on startup, import and restore, and remain idempotent. Account renaming does not rewrite stored history. API presentation resolves current full names and usernames by immutable account ID for Permessi, Banca ore and Inbox; saved snapshots are fallbacks for missing accounts. Resolve only response projections, never persisted state, archive snapshots or concurrency-token inputs. Batch account metadata lookup per list request and return only the identity already attributed to each record.

### 5. Permission-aware shell and existing Settings page

Add `#/amministrazione/account` and a left sidebar with Amministrazione account; use existing visual tokens and responsive navigation patterns. Account editor labels: Nome utente, Nome completo, Amministratore, Centrale, Succursale, Attivo; password creation/reset never shows stored credentials. Show protected status and explain unavailable actions. Use existing inline loading/error/conflict patterns.

Keep Impostazioni at its existing URL, editable for admins and showing the existing allowed read-only status for operational nonadmins. Admin-only users see Amministrazione and Impostazioni. Operational users retain operational tabs; users with both permissions additionally see Amministrazione. No-role users see a no-access screen and logout. The top bar shows full name and a truthful permission summary, including both or neither campuses.

Guard rendering, routes and background hooks, not only links: no operational requests, Inbox notices or sounds for admin-only/no-role sessions. Reauthentication for the same ID currently retains editors; extend this to unmount content whose required permission was removed, without replaying writes. Preserve drafts on ordinary expiry when access remains valid. Theme remains browser-local and accessible without configuration authority.

## Risks / Trade-offs

- Missed single-campus assumption → audit direct campus accesses and exercise all eight admin/campus combinations across backend APIs and frontend controls.
- Broad admin read bypass → inventory every route and background request, test direct negative requests, and scope administrative previews separately.
- Retrospective false attribution → retain known IDs and historical snapshots, verify legacy mappings before conversion, preserve unresolved legacy labels.
- Stale account form restores privileges → revision check and atomic update under the existing account gate, with concurrent-admin tests.
- Permanent admin credentials lost → protected identity plus explicit server password recovery; protection cannot guarantee remembered credentials.
- Cross-store upgrade interrupted → versioned idempotent migrations under maintenance/gate, complete installation snapshot, and activation preflight. Do not rely on a transaction spanning two independent databases.
- Schema rollback incompatible with old code → restore the coordinated installation snapshot only through an explicit recovery procedure; never point old code at newly migrated data by assumption.

## Migration Plan

1. Implement and verify entirely with isolated databases. Obtain any realistic fixture via SQLite online backup, never a direct live-file copy.
2. Prepare a preflight/bootstrap procedure that runs the new account tooling in maintenance before serving the new authorization model. It must securely initialize the protected administrator with operator-supplied credentials and verify original account mappings. Document execution with the new release tooling; the old CLI cannot create this account model. Missing prerequisites must abort activation before the existing service is stopped where possible.
3. Snapshot the complete installation, including auth.sqlite and operational data, using the deployment script's existing consistent backup process. Extend deployment preflight/maintenance only as necessary to support secure bootstrap; keep `./scripts/deploy.sh` the deployment entry point. Credentials must not enter release archives, logs or command arguments.
4. Apply versioned identity migration retaining IDs/hashes/enabled status, grant legacy accounts their old campus access without automatic admin, record verified legacy mappings and normalize attribution without changing other school records. Revoke legacy sessions once the new model activates. Repeat startup must not duplicate accounts or reinterpret history.
5. Validate identity/schema and operational compatibility before accepting requests. On interruption, resume idempotently or fail closed with recovery instructions; do not silently start with partial permissions.
6. Deploy only during implementation, then perform read-only release/environment/asset/health checks on atlante. Behavioral writes stay on the isolated test project, which is stopped after verification.
7. If rollback is required, use the coordinated code/data recovery snapshot through an explicit recovery procedure; do not automatically overwrite newer operational records or restore test data into production.
