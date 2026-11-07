## MODIFIED Requirements

### Requirement: Identity survives operational restoration
Operational backups and JSON archives SHALL exclude password hashes and session credentials. Administrator-only restoration SHALL preserve installed accounts, passwords, enabled status, administrator permission, substitution-campus grants and protected-account identity, invalidate sessions, and require fresh operational baselines. Legacy school-data backups SHALL remain usable without disabling authentication.

#### Scenario: Restore after account changes
- **WHEN** an administrator restores a backup predating a password reset, disablement or permission change
- **THEN** current account state remains in effect and previous sessions require login again

#### Scenario: Fresh machine
- **WHEN** operational data is restored without an initialized identity store
- **THEN** the app fails closed until explicit local account bootstrap

#### Scenario: Portable data
- **WHEN** an operational snapshot or JSON archive is created
- **THEN** it contains no account password hashes or usable session credentials
