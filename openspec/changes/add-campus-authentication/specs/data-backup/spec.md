# Spec Delta

## ADDED Requirements

### Requirement: Identity survives operational restoration
Operational backups and JSON archives SHALL exclude password hashes and session credentials. Centrale-only restoration SHALL preserve installed accounts, passwords, enabled status and sede permissions, invalidate sessions, and require fresh operational baselines. Legacy school-data backups SHALL remain usable without disabling authentication.

#### Scenario: Restore after account changes
- **WHEN** Centrale restores a backup predating a password reset, disablement or sede change
- **THEN** current account state remains in effect and previous sessions require login again

#### Scenario: Fresh machine
- **WHEN** operational data is restored without an initialized identity store
- **THEN** the app fails closed until explicit local account bootstrap

#### Scenario: Portable data
- **WHEN** an operational snapshot or JSON archive is created
- **THEN** it contains no account password hashes or usable session credentials

### Requirement: Restore excludes obsolete writes
Restore SHALL coordinate with browser and Inbox-worker writes and invalidate prior operational generations before accepting subsequent mutations. Older queued requests SHALL not reapply pre-restore data. A failed restore SHALL preserve operational records, release coordination and keep authentication protection active.

#### Scenario: Inbox worker crosses restoration
- **WHEN** the worker fetched data before a restore and attempts to publish it afterward
- **THEN** obsolete work cannot overwrite the restored state and the worker resumes from current configuration/state

#### Scenario: Failed restoration
- **WHEN** restoration fails validation or publication
- **THEN** operational data remains intact and later valid operations are not left permanently blocked
