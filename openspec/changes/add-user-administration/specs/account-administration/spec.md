## Purpose

Let authorized administrators manage named accounts and independent permissions while preserving permanent administrative access and historical identity.

## ADDED Requirements

### Requirement: Independent account permissions
Accounts SHALL have an immutable ID, unique username, full name, password hash, enabled status, administrator permission and zero, one or two substitution-campus grants. Administrator permission SHALL NOT itself grant operational access. Account-management APIs SHALL require administrator permission.

#### Scenario: Independent combinations
- **WHEN** an administrator saves any combination of administrator permission and Centrale/Succursale grants
- **THEN** the server enforces those independent permissions, including both campuses and neither campus

#### Scenario: Direct unauthorized request
- **WHEN** a nonadministrator requests account metadata or submits an account-management operation
- **THEN** access is denied without disclosure or modification

### Requirement: Browser account lifecycle
Administrators SHALL create accounts, edit usernames, full names and permissions, reset passwords and enable or disable accounts. Usernames SHALL be normalized and unique. Passwords SHALL never be returned or logged. Disabling SHALL retain account IDs and attribution; account deletion SHALL NOT be offered.

#### Scenario: Rename an account
- **WHEN** an administrator changes a username and full name
- **THEN** the immutable account ID remains unchanged and the new username is used for subsequent logins

#### Scenario: Invalid account update
- **WHEN** an administrator submits an invalid full name, duplicate username, unknown permission or invalid password
- **THEN** validation rejects the update without partially applying changes

### Requirement: Permanent protected administrator
An explicitly bootstrapped administrator-only account SHALL be protected by immutable identity. Web and supported local administration SHALL reject deleting, disabling or removing administrator permission from it. Its username, full name and password SHALL remain editable. Other administrators SHALL remain ordinarily manageable.

#### Scenario: Renaming cannot bypass protection
- **WHEN** an administrator renames the protected account and then attempts to disable or demote it
- **THEN** the operation is rejected and administrative access remains available

#### Scenario: Recovery without browser access
- **WHEN** the protected administrator password is lost
- **THEN** an authorized local recovery command can reset it without default credentials or changing school records

### Requirement: Serialized account edits
Account changes SHALL validate a current account revision and apply atomically. Stale edits SHALL conflict without overwriting newer changes. Credential, permission and enabled-status changes SHALL revoke affected sessions before subsequent requests can exercise prior access. Clients SHALL NOT choose their own privileges during login.

#### Scenario: Competing administrators
- **WHEN** two administrators edit the same account from the same revision
- **THEN** the second stale save conflicts and preserves its draft for explicit reconciliation

#### Scenario: Remove active permission
- **WHEN** an administrator removes another logged-in account's permission
- **THEN** its old session cannot authorize another request under the removed permission

### Requirement: Safe permission migration
Migration SHALL preserve existing account IDs, passwords and enabled status, map each legacy campus to its matching substitution grant, and SHALL NOT automatically grant administrator permission to Centrale accounts. Enabling the new authorization model SHALL require an explicitly initialized protected administrator. Migration SHALL be repeatable without duplicate accounts or privilege expansion.

#### Scenario: Upgrade existing installation
- **WHEN** the prepared installation upgrades from legacy accounts
- **THEN** existing logins retain their campus scope and the protected administrator can manage settings and accounts

#### Scenario: Missing administrator preparation
- **WHEN** authorization upgrade prerequisites are missing
- **THEN** activation fails closed with actionable local bootstrap instructions instead of exposing setup publicly
