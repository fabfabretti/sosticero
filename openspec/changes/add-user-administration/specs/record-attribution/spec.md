## Purpose

Identify the account responsible for recorded work without confusing its permissions with authorship or changing the meaning of historical records.

## ADDED Requirements

### Requirement: Stable historical author identity
New records with creator or assigning-author attribution SHALL store the authenticated account ID and a snapshot of its full name and username. Existing attribution SHALL survive ordinary record edits. The UI SHALL resolve the current full name and username by account ID, falling back to the saved snapshot when the account is unavailable. Portable exports SHALL retain stored snapshots. Actual campus context SHALL remain separate.

#### Scenario: Account changes after recording
- **WHEN** an attributed account is renamed, disabled or changes campus grants
- **THEN** historical records retain their original ID and name/username snapshot

#### Scenario: Renamed account display
- **WHEN** an account's full name or username changes
- **THEN** Permessi, Banca ore and Inbox display its current identity by ID
- **AND** stored snapshots and operational concurrency tokens remain unchanged

#### Scenario: Both-campus operator
- **WHEN** an operator with both campus grants records a permit, paid availability or paid assignment
- **THEN** authorship identifies that account and never stores its permissions as an author name

### Requirement: Verified legacy attribution mapping
Legacy campus authors SHALL map to explicitly verified existing account IDs and historical account names. Existing account IDs and identity snapshots SHALL take precedence. Ambiguous mappings SHALL retain a visible legacy or unknown attribution rather than inventing an author or preventing access to school records. Mapping SHALL NOT depend on later account permissions.

#### Scenario: One historical account per campus
- **WHEN** verified legacy mappings identify the original Centrale and Succursale accounts
- **THEN** campus-only authors become those account references with the historical campus-account names preserved

#### Scenario: Existing known or unknown creator
- **WHEN** a record already has an account ID or its legacy creator is unknown
- **THEN** migration preserves known identity and does not guess an individual for unknown authorship

### Requirement: Attribution archive compatibility
Validation, JSON archives, database restores, reports and PDFs SHALL accept supported legacy attribution and preserve new identity snapshots. Restoring or importing an archive SHALL NOT require its author accounts to exist locally or recreate them. Resolving attribution SHALL NOT expose credentials or unrelated account metadata.

#### Scenario: Restore onto another installation
- **WHEN** an administrator restores records whose author IDs are absent from the installed identity store
- **THEN** historical snapshots remain readable and no account or permission is created

#### Scenario: Repeat legacy migration
- **WHEN** previously migrated records are loaded or imported again
- **THEN** attribution remains stable without replacing existing snapshots with current account names
