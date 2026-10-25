# Proposal

## Why

Centrale and Succursale need separate credentials and substitution assignment permissions while continuing to see the whole school and share everyday editing. Existing concurrency protection is implemented; authentication must preserve it and extend safe shared use to Orari and configuration publication.

## What Changes

- **BREAKING**: require username/password login for all operational data, attachments and APIs; preserve localhost HTTP support, with secure session handling and HTTPS configuration for future network use.
- Show the account display name and sede at the top right of the topbar, alongside logout.
- Restrict assignment, replacement, removal and Comunicato to the destination row's effective sede. Keep other-sede rows and candidates visible; blocked actions show a prohibited cursor and an accessible explanation. An eligible teacher from either sede can cover an authorized row.
- Record the authenticated accepting account on Inbox acceptance and show it in Cronologia, preserving the original attribution on retries or concurrent acceptance.
- Keep assenze, classi fuori, disponibilità, permessi, manual recupero balances, Inbox and Orari readable/editable by both users across the whole school.
- Keep Settings visible to both; allow shared configuration, timetable/reception imports, archives and backup operations only to Centrale. Theme and campus filters remain browser-local in localStorage and available to both.
- Use locally administered stored accounts: username, display name, hashed password, enabled status and one sede. No hardcoded passwords, administrator web role or account-management page.
- Retain record preconditions and add quiet Orari/Settings refresh, safe timetable/name conflict handling, and explicit coordination of global imports/restores with active writes and older browser baselines.
- Keep identity outside operational backup/restore; restored operational data cannot resurrect passwords, disabled accounts or sessions.
- Document the complete permission matrix, account commands, local preferences, deployment and concurrency behavior in README during implementation.

## Capabilities

### New Capabilities

- `user-auth`: local credentials, account identity, revocable sessions, account administration and local HTTP/HTTPS policy.
- `campus-authorization`: complete access matrix, visible assignment restrictions, shared Orari/configuration concurrency and browser-local preferences.

### Modified Capabilities

- `absence-inbox`: durable accepting-account attribution shown in Cronologia.

- `data-backup`: preservation of installed identity and invalidation of older sessions/baselines across coordinated operational restoration.

## Impact

Build on completed `harden-shared-edit-concurrency`. Affects FastAPI authorization and write boundaries, explicit identity persistence/administration, restore/import and Inbox worker coordination, React shell/topbar, all API clients, Orari/Settings refresh and conflict UX. Add a maintained password-hashing dependency and migrate protected-route test fixtures. No operational record reset, new database service, LAN exposure, OAuth, MFA, email recovery, self-registration or new draft workflow. README updates, isolated testing and normal-service rebuild/recreate belong to implementation, not this planning revision.
