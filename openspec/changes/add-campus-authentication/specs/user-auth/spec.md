# Spec Delta

## Purpose

Authenticate office accounts with local credentials and revocable sessions while supporting localhost use and preserving existing work during reauthentication.

## ADDED Requirements

### Requirement: Login protects operational data
A valid session SHALL be required for all operational APIs, exports and attachments. Public access SHALL be limited to static assets, login/session bootstrap and non-sensitive environment status. Invalid credentials SHALL produce a generic error without revealing account existence. No default or hardcoded credentials SHALL be provided.

#### Scenario: Anonymous direct access
- **WHEN** an unauthenticated client requests day data, Orari, Inbox, Settings data, exports or attachments
- **THEN** the server returns 401 without operational data

#### Scenario: Successful login
- **WHEN** valid enabled-account credentials are submitted
- **THEN** a fresh session is issued and the requested application route becomes available

### Requirement: Stored locally administered accounts
Accounts SHALL have a unique username, display name, one sede, enabled status and a salted adaptive password hash. An explicit local command SHALL create, list nonsecret account metadata, rename, reset, enable/disable and change account sede through a selected identity store. Passwords SHALL not be logged, hardcoded or passed as arguments. No administrator web account or account-management page SHALL be required.

#### Scenario: Initial setup
- **WHEN** local administration creates Centrale and Succursale accounts
- **THEN** ordinary school records remain unchanged and no third administrator login is required

#### Scenario: Account change revokes sessions
- **WHEN** a password is reset, an account is disabled or its sede changes
- **THEN** its earlier sessions cease authorizing requests and reenabling does not revive them

### Requirement: Topbar account identity
Authenticated pages SHALL show the account display name and sede at the top right of the topbar, with an accessible logout action. Username and display name SHALL be independent. Identity SHALL remain visible and navigation usable on narrow screens.

#### Scenario: Named Centrale account
- **WHEN** Maria logs in with a Centrale account
- **THEN** the topbar identifies Maria and Centrale even while viewing Succursale data

### Requirement: Revocable bounded sessions
Sessions SHALL rotate on login, expire after 12 hours and be revoked on logout. Cookies SHALL be HttpOnly and SameSite protected. Unsafe browser requests, including authentication actions, SHALL enforce same-origin CSRF protection. Login failures SHALL be temporarily rate limited with bounded state and no permanent account lockout.

#### Scenario: Logout replay
- **WHEN** a client reuses a logged-out session cookie
- **THEN** protected operations return 401

#### Scenario: Foreign-origin mutation
- **WHEN** another origin submits a credentialed mutation
- **THEN** it is rejected without changing data

#### Scenario: Repeated invalid passwords
- **WHEN** the bounded failed-attempt allowance is exceeded
- **THEN** attempts are temporarily limited without revealing whether the username exists

### Requirement: Local HTTP deployment
The existing loopback HTTP deployment SHALL support login without certificate setup or unavailable HTTPS redirects. HTTPS configuration SHALL use Secure cookies. Normal Compose SHALL retain its current network binding and operational database. Arbitrary forwarded headers SHALL not establish trust.

#### Scenario: Current localhost deployment
- **WHEN** the app is accessed through the configured loopback HTTP origin
- **THEN** login and authenticated use work without local certificates

#### Scenario: HTTPS configuration
- **WHEN** an HTTPS origin is explicitly configured
- **THEN** session cookies are Secure and origin checks use that trusted configuration

### Requirement: Non-destructive reauthentication
Expiration SHALL preserve existing in-memory editors/inputs while requiring login before further work. Polling SHALL pause while unauthenticated. Reauthentication SHALL return to the requested route without automatically replaying a write or updating its retained baseline. Logout/account switching SHALL not expose the prior account's retained operational screen.

#### Scenario: Session expires during a permit or Orari edit
- **WHEN** an action returns 401
- **THEN** login is offered without clearing the entered work
- **AND** any later save explicitly rechecks permission and concurrency

#### Scenario: Permission failure
- **WHEN** an authenticated action returns 403
- **THEN** the UI explains the sede/configuration restriction without logging the user out
