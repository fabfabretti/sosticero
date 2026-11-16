# Operational Audit Spec Delta

## Purpose

Provide server-side evidence to investigate disappearing operational records, distinguishing committed edits, rejected saves and changes to row visibility without recording private document contents.

## ADDED Requirements

### Requirement: Atomic record change evidence
The system SHALL retain a durable before/after event for every committed change to an assignment, absence, class-out entry or manual availability/site. Events SHALL cover direct and bulk writers, include communication/acceptance metadata, and commit atomically with the change. Unchanged tracked values SHALL generate no change event.

#### Scenario: Assignment is removed
- **WHEN** an authorized operation removes a stored assignment
- **THEN** its event identifies the day and row, preserves the prior assignment projection and records an absent after value
- **AND** the event and removal commit together

#### Scenario: Communication is changed
- **WHEN** Comunicato, Accettata, Avvisato or campus-communication metadata changes
- **THEN** the event preserves the old and new tracked values without misreporting an assignment deletion

#### Scenario: Bulk or indirect writer changes data
- **WHEN** import, staffing, timetable reconciliation or Inbox processing changes a tracked persisted value
- **THEN** each changed record has evidence attributable to the operation
- **AND** unchanged records generate no events

#### Scenario: Audit insertion or later transaction step fails
- **WHEN** an audit insert fails or the operational transaction subsequently rolls back
- **THEN** neither the operational change nor its success event remains committed
- **AND** the request does not report a successful save

#### Scenario: Row visibility changes
- **WHEN** an absence or class-out edit removes a current row but preserves its stored assignment
- **THEN** the edit is journaled without recording a fabricated assignment deletion
- **AND** existing assignment-review behavior remains intact

### Requirement: Attributable and correlated events
Each event SHALL identify its UTC time, record group/day/key, source operation, server-generated request or operation ID, and authenticated account identity when available. System work SHALL be explicitly identified. Attribution SHALL be server-derived and isolated between concurrent operations.

#### Scenario: Two accounts edit different records
- **WHEN** two authenticated requests commit changes concurrently
- **THEN** each event carries the correct account and correlation ID
- **AND** neither event inherits the other request's identity

#### Scenario: Worker follows an authenticated request
- **WHEN** background or initialization work changes a tracked record
- **THEN** its event identifies the system source and does not inherit a prior browser account

### Requirement: Safe failed mutation diagnostics
The system SHALL emit a separate correlated diagnostic for failed or rejected relevant mutation requests, including time, safe operation identity, status and error category. The response SHALL expose the server-generated correlation ID. A rejection SHALL never appear as a committed change event.

#### Scenario: Stale delete is rejected
- **WHEN** removal fails a precondition with a conflict response
- **THEN** a diagnostic records the conflict and request ID
- **AND** no assignment deletion event is committed

#### Scenario: Authentication or validation fails
- **WHEN** a relevant mutation has missing authentication or invalid input
- **THEN** its diagnostic safely records the outcome without trusting submitted actor identity or dumping the payload

### Requirement: Diagnostic data minimization
Journal content SHALL be restricted to operational identifiers, account attribution, hours/site, assignment type/class/permit reference and communication metadata needed to reconstruct changes. Passwords, PINs, tokens, cookies, private notes, attachment data and raw request bodies SHALL be excluded from change and failure logs.

#### Scenario: Request contains a private note or attachment
- **WHEN** a tracked mutation includes private text or attachment data
- **THEN** those contents and attachment references do not appear in diagnostic records

### Requirement: Server-only history lifecycle
The journal SHALL be available through documented read-only server investigation, without an application viewer or public API. Live events SHALL be retained for 90 days and older events pruned incrementally. JSON school-data imports SHALL preserve journal history; portable JSON exports SHALL exclude it.

#### Scenario: Import school data
- **WHEN** a school-data JSON archive changes tracked records
- **THEN** existing journal history remains and the resulting changes are journaled
- **AND** exporting the school data does not include the journal

#### Scenario: Retention runs
- **WHEN** old events are pruned during audited writes
- **THEN** events within the 90-day retention window remain
- **AND** pruning work is bounded per write

### Requirement: Honest upgrade and restore evidence
Upgrade SHALL preserve operational data without inventing past events. Physical backup restore SHALL retain the existing safety snapshot and emit correlated restore outcome diagnostics. Documentation SHALL explain that the restored live journal reflects the selected backup and newer evidence must be inspected in the safety snapshot.

#### Scenario: Restore a backup predating the journal
- **WHEN** an authorized restore selects an older valid database without journal tables
- **THEN** the restored application initializes an empty journal without inventing historical edits
- **AND** the pre-restore safety snapshot remains available with the prior journal
- **AND** restore diagnostics distinguish start, success or failure
