# Teacher Portal Spec Delta

## Purpose

Provide individually administered teacher access to a private effective timetable without granting office permissions or requiring external authentication and email services.

## ADDED Requirements

### Requirement: Stable personal teacher access
Teacher access SHALL link one account to one stable teacher person, separately from office accounts and timetable sources. Email changes, renames and dated replacements SHALL NOT transfer account ownership. Existing teacher and office records SHALL remain unchanged.

#### Scenario: Replacement has personal access
- **WHEN** a replacement teacher receives portal access
- **THEN** the account belongs to that person and resolves their own effective timetable by date
- **AND** the original teacher's account and credentials remain separate

#### Scenario: Missing linked person
- **WHEN** a linked person cannot be resolved after an import or restore
- **THEN** timetable access fails closed without matching another person by name or source

### Requirement: Efficient administrator access management
Only administrators SHALL manage teacher login emails, enabled status and PINs in the existing Docenti view. The view SHALL preserve teacher creation and staffing workflows, provide a distinct email-editing mode with Tab navigation, search, filters and a persistent save/cancel toolbar. Activation actions SHALL operate outside email-editing mode. Failed or stale saves SHALL preserve drafts without partial changes.

#### Scenario: Enter multiple emails
- **WHEN** an administrator types emails across several teacher rows using Tab and saves once
- **THEN** all valid edits persist without opening per-teacher dialogs

#### Scenario: Competing edits
- **WHEN** another administrator has changed an edited access record
- **THEN** the batch is rejected without overwriting newer values or losing the local draft

#### Scenario: Non-administrator direct request
- **WHEN** an operational non-admin or teacher calls access-management endpoints
- **THEN** the request is denied without revealing credentials or modifying accounts

### Requirement: Email login identifiers
Login emails SHALL be validated, trimmed, compared case-insensitively and unique among teacher accounts. Email SHALL act only as a login identifier, without delivery or ownership-verification claims. Access SHALL remain disabled until a valid email and PIN exist; removing an email SHALL require disabling access.

#### Scenario: Duplicate batch email
- **WHEN** two rows contain the same normalized email or conflict with a saved account
- **THEN** the entire save fails with identifiable row errors and no partial update

#### Scenario: Incomplete activation
- **WHEN** an administrator enables a teacher without a saved email
- **THEN** activation is rejected and the missing prerequisite is explained

### Requirement: Personal PIN lifecycle
Administrators SHALL generate or reset cryptographically random eight-digit personal PINs, preserving leading zeros. PINs SHALL be displayed only in the successful issuance response and stored only as adaptive salted hashes. Later account reads SHALL NOT retrieve them. Recovery SHALL use administrator reset without email delivery.

#### Scenario: Issue a PIN
- **WHEN** an administrator generates a PIN for a teacher with a saved valid email
- **THEN** the new PIN is shown for manual distribution and later account listing omits it
- **AND** generating the PIN alone does not enable a disabled account

#### Scenario: Lost issuance response
- **WHEN** an issuance response cannot be recovered after a reset succeeds
- **THEN** the administrator can explicitly reset again but cannot retrieve the previous PIN

### Requirement: Protected teacher authentication
The dedicated portal SHALL authenticate enabled teachers using email and PIN, return generic credential failures and temporarily rate-limit repeated attempts by identifier and client source. No public teacher list, registration or default credentials SHALL be exposed. Authentication actions SHALL enforce same-origin protection.

#### Scenario: Invalid credentials
- **WHEN** an unknown email, wrong PIN or disabled account is submitted
- **THEN** the response does not reveal which credential or account state caused failure

#### Scenario: Repeated guesses
- **WHEN** repeated attempts exceed the configured allowance
- **THEN** further attempts are temporarily limited without permanent account lockout

### Requirement: Restricted revocable teacher sessions
Teacher sessions SHALL rotate at login, expire after twelve hours, and be revoked on logout, email change, PIN reset or disabling. Cookies SHALL be HttpOnly and SameSite protected, and Secure on configured HTTPS. Teacher sessions SHALL authorize only personal portal reads and session actions, never office APIs or administrative actions.

#### Scenario: Replay after reset
- **WHEN** a previously issued teacher session is reused after PIN reset
- **THEN** protected portal requests return 401 and re-enabling does not revive revoked sessions

#### Scenario: Office API access
- **WHEN** a teacher session requests day data, full Orari, staffing, Inbox, exports, attachments or settings
- **THEN** the request is denied without school-wide data

### Requirement: Server-owned personal timetable projection
The server SHALL derive timetable ownership from the authenticated teacher, resolve the selected date's timetable version, overrides and dated staffing, and return only that person's periods, classes, rooms, activities and campuses. Responses SHALL exclude colleague catalogs, staffing documents and operational records. Teacher identifiers supplied by clients SHALL NOT select another person's data.

#### Scenario: Modified request
- **WHEN** a teacher changes query parameters or submits another person's identifier
- **THEN** the server rejects the selector or returns only the authenticated person's permitted timetable

#### Scenario: Coverage boundary
- **WHEN** a replacement browses dates inside and outside their appointment
- **THEN** inherited commitments appear only during coverage with POT excluded according to existing rules
- **AND** neither person's credentials follow the timetable source

### Requirement: Coherent personal timetable interface
The portal SHALL open on today's date in Europe/Rome and provide previous/next date, date selection and return-to-today controls. It SHALL identify the teacher, offer logout, and render the personal daily timetable with existing UI styling and accessible narrow-screen layouts. Loading, failure, no timetable and no scheduled lessons SHALL be distinguishable.

#### Scenario: No scheduled lessons
- **WHEN** the selected date is a weekend or has no commitments
- **THEN** the portal shows an explicit empty-day message without showing another teacher

#### Scenario: Expired session or account switch
- **WHEN** the session expires or the teacher logs out or switches identity
- **THEN** private timetable content is cleared or hidden before another identity can see it
- **AND** no office polling or operational requests run from the teacher shell

### Requirement: Confidential identity storage and compatible rollout
Teacher credentials and sessions SHALL remain in the protected identity store, outside portable school-data archives. Migration SHALL preserve existing office accounts and operational data, create no enabled default teacher access and avoid database side effects during module imports. Private responses SHALL prevent shared caching.

#### Scenario: Upgrade existing installation
- **WHEN** the release is installed on an existing school database
- **THEN** current accounts, assignments and staffing are preserved and teacher access remains disabled until configured

#### Scenario: Export school data
- **WHEN** an operational school-data archive is exported
- **THEN** teacher emails used for login, PIN hashes and sessions are excluded

### Requirement: Immediate individual and bulk activation
Administrators SHALL activate or deactivate accounts immediately without a subsequent Save. Activation SHALL atomically generate only missing PINs and preserve existing PINs. The table SHALL support selection and activation of all eligible teachers, show saved status only after success, and disable account actions during email editing. Stale batches SHALL fail without partial changes.

#### Scenario: First activation
- **WHEN** an administrator activates a teacher with a saved email and no PIN
- **THEN** the server generates a PIN, saves the active state and displays the new code in the same operation

#### Scenario: Bulk preparation
- **WHEN** an administrator activates selected eligible teachers or all eligible teachers
- **THEN** only missing PINs are generated and previously issued PINs remain valid
- **AND** failed or stale batches change no account

### Requirement: Retained one-time distribution list
Newly issued PINs SHALL remain visible for copy or local text download until explicitly dismissed or the administrator leaves or loses the session. Later activation or email saves SHALL NOT silently erase the distribution list. Closing the list SHALL warn that the codes cannot be retrieved again.

#### Scenario: Distribute first-time codes
- **WHEN** bulk activation returns newly issued PINs
- **THEN** the administrator can copy or download the complete list, preserving leading zeros
- **AND** subsequent access-state changes keep that list visible
