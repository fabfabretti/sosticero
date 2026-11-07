## MODIFIED Requirements

### Requirement: Stored locally administered accounts
Accounts SHALL have an immutable ID, unique username, full name, independent administrator permission and substitution-campus grants, enabled status and a salted adaptive password hash. An explicit local command SHALL create, list nonsecret account metadata, rename, reset, enable/disable and change account sede through a selected identity store. Passwords SHALL not be logged, hardcoded or passed as arguments. Administrator account management SHALL also be available through the protected browser administration area. Local commands SHALL enforce protected-account invariants and support username changes and permission management.

#### Scenario: Initial setup
- **WHEN** local administration creates named operator accounts and a protected administrator-only account
- **THEN** ordinary school records remain unchanged and the protected administrator can manage accounts independently of campus access

#### Scenario: Account change revokes sessions
- **WHEN** a password is reset, an account is disabled or its permissions change
- **THEN** its earlier sessions cease authorizing requests and reenabling does not revive them

### Requirement: Topbar account identity
Authenticated pages SHALL show the account full name and permission summary at the top right of the topbar, with an accessible logout action. Username and full name SHALL be independent. Identity SHALL remain visible and navigation usable on narrow screens.

#### Scenario: Named Centrale account
- **WHEN** Maria logs in with a Centrale account
- **THEN** the topbar identifies Maria’s full name and Centrale even while viewing Succursale data

#### Scenario: Administrator without campus grants
- **WHEN** the protected administrator signs in
- **THEN** the topbar shows its full name and administrator status without inventing a campus


### Requirement: Non-destructive reauthentication
Expiration SHALL preserve existing in-memory editors/inputs while requiring login before further work. Polling SHALL pause while unauthenticated. Reauthentication SHALL return to the requested route without automatically replaying a write or updating its retained baseline. Logout/account switching SHALL not expose the prior account's retained operational screen.

#### Scenario: Session expires during a permit or Orari edit
- **WHEN** an action returns 401
- **THEN** login is offered without clearing the entered work
- **AND** any later save explicitly rechecks permission and concurrency

#### Scenario: Permission failure
- **WHEN** an authenticated action returns 403
- **THEN** the UI explains the sede/configuration restriction without logging the user out

#### Scenario: Same account loses permission
- **WHEN** a user reauthenticates after losing access to an open operational editor
- **THEN** inaccessible content is unmounted and no retained write is replayed
- **AND** only currently permitted destinations and actions remain available
