# Proposal

## Why

Campus-named accounts and server-only account administration prevent staff from managing their own access. Campus membership also incorrectly grants shared configuration powers and is used as a substitute for the identity of the person recording work.

## What Changes

- Add independent administrator permission and substitution-campus grants (Centrale, Succursale, both or neither), retaining immutable account IDs, usernames, full names and securely hashed passwords.
- Add a protected, dedicated admin-only account that cannot be deleted, disabled or stripped of admin permission; allow other accounts to receive admin permission.
- Add an admin-only Amministrazione top-bar destination with a left sidebar initially containing Amministrazione account. Support account creation, editing, password reset and enable/disable; use disabling rather than account deletion.
- Show full names in the top bar. Keep shared configuration in Impostazioni and make it administrator-controlled.
- **BREAKING**: Centrale no longer grants shared settings powers. Accounts without substitution-campus grants cannot read operational data; admin-only accounts retain the administrative configuration access they require.
- Authorize assignment and manual publication actions against explicit permitted target campuses, including both source and destination for conflict moves.
- Replace campus-based creator attribution with immutable account IDs and historical full-name/username snapshots. Preserve actual campus context separately and migrate verified legacy attribution without inventing individual authorship.
- Preserve account identity and school records through migration, operational imports and restoration; retain secure local bootstrap/recovery.

## Capabilities

### New Capabilities

- `account-administration`: Protected administrator bootstrap and browser-based account lifecycle with independent permissions.
- `record-attribution`: Account-based historical attribution and compatible migration of legacy campus authors.

### Modified Capabilities

- `user-auth`: Expanded account/session identity, full-name presentation and safe reauthentication following permission changes.
- `campus-authorization`: Independent administration and operational access, campus-set assignment/publication checks and admin-owned configuration.
- `app-shell`: Permission-aware destinations, administration sidebar and appropriate landing pages/background activity.
- `data-backup`: Administrator-owned restoration that preserves installed account permissions and protected-account state.

## Impact

Backend auth schema, local account CLI, middleware route policy, assignment/publication endpoints and attribution validation/serialization change. Frontend session types, navigation, operational controls, Settings, paid-hour/permit attribution and exports need coordinated updates. Existing auth, publication, paid-hour, import/restore and frontend regression tests must be adapted and extended. No external identity provider or new dependency is planned. Self-registration, email recovery, custom roles, account deletion and a general audit-log product are out of scope. Implementation must use isolated test data, then the existing atlante deployment script and read-only release checks.
