# Spec Delta

## ADDED Requirements

### Requirement: Durable accepting-account attribution
Successful Inbox acceptance SHALL atomically record the authenticated account identifier and snapshots of its username and display name alongside the processing time and accepted status. Attribution SHALL come from the server session and SHALL not be supplied or overridden by the browser payload.

#### Scenario: Accepted by a named account
- **WHEN** Maria accepts an incoming absence while authenticated
- **THEN** the saved item identifies Maria's account as the acceptor and Cronologia shows its saved display name, username and processing time

#### Scenario: Failed or forged acceptance
- **WHEN** acceptance fails or the request submits a different purported accepting account
- **THEN** failure stores no acceptance attribution and submitted identity fields cannot replace the authenticated acceptor

### Requirement: Original acceptance attribution is immutable
Repeated or concurrent acceptance SHALL retain the first successful acceptor and processing time. Account rename, disablement or missing identity-store records SHALL not erase or rewrite accepted-item attribution. Operational database backups/restores SHALL preserve these nonsecret historical fields.

#### Scenario: Two different accepting accounts
- **WHEN** Centrale and Succursale concurrently accept the same pending item
- **THEN** only the successful first acceptance records an acceptor
- **AND** the second response reports the saved attribution without replacing it

#### Scenario: Account later changes
- **WHEN** the accepting account is renamed, disabled or unavailable after operational data restoration
- **THEN** Cronologia still displays its identity as saved at acceptance

### Requirement: Legacy acceptance history
Previously accepted items lacking attribution SHALL remain valid and display that the acceptor is unavailable. The application SHALL not infer or backfill an acceptor from the current session. This attribution requirement SHALL apply to acceptance without introducing a general edit audit trail.

#### Scenario: Old accepted item
- **WHEN** Cronologia displays an accepted item saved before account attribution existed
- **THEN** it shows accepted status and any saved processing time with an unavailable-author indication
