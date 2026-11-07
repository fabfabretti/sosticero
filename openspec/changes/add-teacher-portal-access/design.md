# Design

## Context

See proposal.md for motivation. The working tree already contains completed but unarchived `add-user-administration` and `manage-permanent-teacher-replacements` changes. Plan against their present code, preserve their edits and do not treat older main specs' single-campus/local-only account descriptions as the current implementation.

`backend/auth.py` maintains `auth.sqlite`, Argon2 hashes, twelve-hour sessions, request policy, CSRF and a cross-process gate. Its office account model uses administrator/campus grants. `Staffing.tsx` at `/amministrazione/docenti` has Assenze prolungate and Docenti tabs, person creation and preview/apply staffing workflows. `TeacherTimetables.tsx` consumes the school-wide `/api/orari` payload with teacher catalogs, imported/effective datasets and overrides; that payload is unsuitable for teacher access. Timetable and appointment modules already resolve dated ownership, stable people and POT exclusion.

## Goals / Non-Goals

**Goals:** Reuse proven authentication primitives while enforcing a distinct teacher authorization boundary; minimize new UI and avoid duplicating timetable calculation.

**Non-Goals:** No expansion of office grants, generic role framework, external identity integration, student/parent access, message delivery or operational publication changes. This release shows the effective timetable rather than the published supplenze snapshot. It offers no daily absence, assignment or recupero overlays and no claim that a lesson was performed.

## Decisions

### 1. Separate teacher principals in the existing identity store

Add teacher account/session tables in `auth.sqlite`, with immutable account ID, unique stable person ID, normalized unique email, nullable PIN hash, enabled flag and revision. Unconfigured people need no persistent account. Do not add teacher campus grants to office accounts: existing shared operational routes intentionally expose school-wide data. Reuse hashing, token hashing, gate and origin validation helpers, not the office authorization scope.

Use a distinct teacher cookie and `/api/teacher/auth/{login,session,logout}` endpoints. Middleware explicitly classifies teacher bootstrap/session routes and `/api/teacher/timetable`; unknown routes remain denied. Office credentials never authenticate as teacher credentials, even if the textual identifiers match. Both session types can coexist without changing authority. Use HTTP-only SameSite=Lax cookies scoped to teacher APIs, Secure on configured HTTPS, twelve-hour absolute expiry and rotation on login. Require same-origin checks on login/logout and CSRF for authenticated unsafe actions. Logout deletes the cookie with matching scope. Never log secrets or place PINs in URLs.

### 2. Batch ordinary access edits; explicit credential issuance

Extend the existing Docenti tab to a responsive table: teacher/current profile information, Email di accesso, access enabled status and Genera/Reimposta PIN. Preserve Nuovo docente and the entire Assenze prolungate tab. Filter by name/email and Senza email. Labeled inputs follow natural row Tab order; one Salva modifiche submits changed rows with individual revisions. Keep pending changes when filtering and expose the total unsaved count. Warn before navigation discards drafts; background refresh must not overwrite drafts.

Use admin-only list/batch-save and per-person PIN issuance endpoints. Derive the people list from the existing stable-person catalog, never client-created account ownership. Validate the whole batch, including final unique emails and revisions, before committing under the identity gate. Return row errors without partial writes. Initial rows have no email/PIN and disabled access. Removing an email requires disabled access. On email change/disable, revoke sessions atomically with the update.

PIN issuance is a separate explicit action available after a valid email is saved and without unsaved edits for that row. It generates an eight-character decimal string with a cryptographic generator, including leading zeros, hashes it using existing Argon2 parameters and atomically replaces it while revoking sessions. Show the PIN once in a dismissible accessible panel with a copy action; do not persist it in browser storage or include it in list responses. Clear the revealed value on dismissal/navigation/logout. An explicit reset confirmation prevents accidental replacement. Issuance leaves enabled state unchanged; the administrator enables access after setup. Lost responses require another explicit reset, never automatic replay. Manual distribution and administrator recovery are documented.

### 3. Bounded guessing protection and explicit identity lifecycle

Normalize email by trimming and case-folding according to this application's login contract; validate ordinary email syntax without school-domain assumptions or delivery checks. Preserve eight-digit PIN strings. Return the same login failure for missing, disabled or invalid accounts, using a dummy hash check to avoid obvious timing differences.

Reuse the bounded attempts store with teacher-specific key namespaces, applying temporary limits both per normalized identifier and trusted client source. Proposed initial policy: five failed attempts per identifier per fifteen minutes and thirty per source per fifteen minutes, with bounded cleanup. Forwarded headers are trusted only through existing deployment configuration. Test cross-source guessing and cross-identifier attempts. Document that these are low-entropy credentials and that Google can later replace/add an authenticator linked to the same immutable teacher account; do not implement generic provider infrastructure now.

Keep credentials separate from school-data exports. If restore/import removes a referenced person, fail closed rather than name-match or reuse a cattedra owner. A rename or appointment change does not transfer credentials; changed email, PIN or enabled state revokes sessions. Out-of-period replacements may log in but see only their own effective commitments, including an empty day where appropriate.

### 4. Dedicated minimal timetable projection

Add a date-validated, read-only `/api/teacher/timetable?day=YYYY-MM-DD` endpoint; default today in Europe/Rome. Resolve the person solely from the current teacher session. Within a consistent operational read, use existing timetable version/override/appointment resolution and name presentation, then project only the authenticated person's selected weekday cells and required period labels. No client-side filtering of `/api/orari` and no fetching `/api/staffing` from the teacher shell.

Return teacher identity, selected date, applicable timetable status and period entries with classes, rooms, activities and site. Do not send the school-wide dataset, original/covering teacher identities, source maps, override evidence, absences, permit balances, reception visitor data or assignments. Distinguish absent timetable configuration, unresolved person and a valid empty date. Reuse existing hour definitions rather than inventing clock times. Set private authenticated responses to Cache-Control: no-store; no service-worker/offline persistence.

### 5. Independent teacher shell using existing design tokens

Expose a dedicated `/docenti` entry compatible with the deployed frontend router, with login and Il mio orario views. Keep the office entry unchanged; provide a discoverable Portale docenti link. Use existing ui-page, ui-field, ui-button, surface, typography, theme and loading/error conventions. Login fields are Email istituzionale and PIN personale, with a masked numeric-friendly PIN input and clear administrator-reset help; no teacher dropdown or fake email recovery.

On login show the teacher name, logout, Oggi, previous/next date and a date input. Render one chronological daily timetable, with explicit period, classes, activity, room and campus labels and readable empty states. Provide keyboard focus, accessible control labels and a narrow-screen layout without forcing a full week grid. Isolate bootstrap, expiry handling and refresh from office hooks so the portal never mounts office Inbox polling or operational components. Clear private state at logout, expiry or identity change; discard stale in-flight responses on date/account changes. Refresh quietly on focus and periodically using the existing approach, preserving selected date and showing a recoverable error rather than substituting another person's data.

## Risks / Trade-offs

- Short numeric credentials can be guessed or shared → random eight-digit PINs, adaptive hashes, identifier/source limits, bounded sessions and revocation; manual distribution remains an administrative responsibility.
- Reusing office route authorization exposes school data → separate teacher principals/cookies, explicit route allowlist and direct endpoint negative tests.
- Source ownership mistaken for personal identity → link stable people and reuse dated appointment resolution; test successive replacements and dates before/during/after coverage.
- Batch edits overwrite another administrator → row revisions and all-or-nothing transaction; retain drafts on conflict.
- Snapshot restore leaves stale identity links → reject unresolved people and never infer identity from names or source IDs; portable school archives do not overwrite credentials.
- Existing unpublished work changes prerequisites → implementation starts from the present administration/staffing behavior and checks their regression suites; no cleanup or unrelated rewrites.

## Migration Plan

1. Add idempotent explicit initialization of teacher identity tables without altering office account meanings; module import remains inert. Verify old identities, stored operational records and staffing state on isolated fixtures.
2. Implement and exercise APIs/UI against temporary isolated databases only. Container checks use `compose.testing.yaml`, unique TEST_PROJECT and mktemp TEST_DATA_DIR, verify mounts, allocated localhost port and testing environment/ribbon before mutations.
3. Document setup, one-time PIN distribution, reset/revocation and the independent teacher URL. No teacher is activated automatically by migration.
4. After implementation and verification, deploy with `./scripts/deploy.sh`; perform read-only release, health, environment and served-asset checks on atlante, then stop only this work's testing project.
5. Teacher tables are additive; roll back code only after verifying office identity/schema compatibility. Do not restore or overwrite authoritative operational data as a routine rollback. Preserve the deployment snapshot for explicit recovery, and keep teacher endpoints unavailable if disabled by rollback.

## UX correction after first release

The user reported that staged activation, the distant save action and per-person PIN setup were confusing. Replace that interaction with separate email edit mode and immediate access actions. Email mode has a persistent toolbar with Save email/Cancel; account actions are unavailable until the mode is closed. Normal mode displays saved account status, selection checkboxes, individual Activate/Deactivate and a clearly scoped Activate all with email action. Activation is a revision-checked atomic backend operation which creates only missing PINs, never resets existing ones and commits enabled status immediately. New PINs are merged into an in-memory copyable/downloadable text list retained until explicit dismissal; expiry clears it. Individual reset remains explicit and confirmed. Office/teacher entry links use existing button styles, and teacher login supports PIN visibility and trimming pasted surrounding whitespace without weakening attempt limits.

Read-only production diagnosis verified the reported account was enabled, its supplied PIN matched the saved hash and its person link resolved; five failed attempts were recorded. Do not reset that production credential or perform production behavioral writes to make verification pass. Reproduce setup, login, PIN copying and attempt limits on isolated fixtures.
