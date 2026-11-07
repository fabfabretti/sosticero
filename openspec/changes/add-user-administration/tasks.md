# Tasks

## 1. Identity schema and secure bootstrap

- [x] 1.1 Add versioned account migration for independent admin/campus grants, protected identity and revisions; verify legacy IDs, password hashes and enabled states survive, repeated migration is stable and Centrale receives no implicit admin.
- [x] 1.2 Extend local account administration with secure protected-admin bootstrap, username/permission editing and recovery; verify CLI tests cover protected disable/demotion rejection after rename, invalid values and secret-free output; document commands in README.
- [x] 1.3 Add an activation preflight and maintenance/bootstrap sequence using new release tooling, preserving the deployment entry point; verify missing admin prerequisites abort safely and interrupted migration resumes or fails closed on isolated fixtures; document snapshot and recovery order in server deployment docs.

## 2. Server permissions and account administration

- [x] 2.1 Replace single-campus middleware policy with explicit admin, operational and configuration-status permissions; verify a route/method matrix for all eight combinations, including denied account metadata, operational attachments, Inbox and direct API bypass attempts.
- [x] 2.2 Add account list/create/update/password-reset APIs with atomic revision checks, normalized unique usernames and protected-account invariants; verify stale concurrent edits conflict, invalid updates have no partial effects and responses never expose hashes/passwords.
- [x] 2.3 Extend session responses and revocation for new permissions and self-updates; verify password reset, disable, demotion and campus removal invalidate old sessions, and retain origin/CSRF/rate-limit/cookie protections; document account-management behavior.
- [x] 2.4 Update assignment source/destination checks and explicit manual publication campus/status; verify single-campus denial, both-campus moves, unknown-campus rejection, admin-only denial, status selection and existing global double-booking/concurrency safeguards.
- [x] 2.5 Make Settings configuration, imports/previews, full archives, backups/restore and scheduling admin-owned; verify admin-only workflows function without a blanket operational-read bypass, nonadmins retain allowed status reads/ordinary exports, and system publication/Inbox workers continue functioning.

## 3. Attribution and portable data

- [x] 3.1 Implement server-derived author snapshots and verified legacy mapping for permit creators, paid availability and paid assignments; verify existing createdBy IDs and Inbox snapshots take precedence, unresolved legacy authors remain readable, repeat migration is stable and actual campus context is unchanged.
- [x] 3.2 Update validators, record concurrency serialization and import/restore compatibility for new author shapes; verify mixed legacy/new archives, missing foreign accounts and post-rename restore preserve historical snapshots without changing installed users, protected identity or permissions.
- [x] 3.3 Update permit/paid-hour UI, reports and PDF attribution to full names with username disambiguation; verify rendering/export tests cover long names, unknown historical authors and account renames; document the new data format and legacy handling in banca-ore data docs/README.

## 4. Administration UI and permission-aware navigation

- [x] 4.1 Add Amministrazione top-bar destination, stable account subpage and left sidebar using existing tokens; verify direct links, reload/history, keyboard navigation, both themes and narrow layouts, and nonadmin route denial.
- [x] 4.2 Build account list and create/edit/reset/enable-disable workflows with revision conflicts and protected-state explanations; verify form validation, all grant combinations, self-session revocation feedback and no password persistence; document browser administration.
- [x] 4.3 Update session types, full-name topbar, Settings controls, assignment permissions and publication selector; verify both/neither campus summaries and allowed/blocked actions agree with server policy.
- [x] 4.4 Gate shell routes and background activity by current permissions; verify admin-only landing, no-role message/logout, no operational polling/notices/sounds for admin-only users, permission-loss unmounting and account switching without stale content; preserve drafts on ordinary expiry when still authorized.

## 5. Integration and release

- [x] 5.1 Run relevant backend/frontend regression suites and the production frontend build; verify migration, permissions, attribution, imports/restores, publication and account-management integration pass, without reading minified bundles.
- [x] 5.2 Rebuild/recreate only a unique isolated compose.testing.yaml project with mktemp TEST_DATA_DIR and explicit -p; inspect mount/allocated port, confirm /api/environment reports testing:true and the red TESTING ribbon before behavioral writes; verify operator/admin workflows and stop only that project afterward.
- [x] 5.3 Verify intended deployment bootstrap credentials and legacy account mappings through the documented secure procedure, deploy the implemented release with ./scripts/deploy.sh, and verify atlante release marker, served asset hash, environment and health using read-only checks; report any recovery issue and database currently in use.

## Workflow follow-up

- Ask whether the user wants to commit before committing any work.
- Archive only after implementation and verification are complete and archiving is requested.
