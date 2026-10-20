# Spec Delta

## Purpose

Let staff correct teacher presentation while preserving imported names, stable identities and existing operational records.

## ADDED Requirements

### Requirement: Manage current name overrides
Orari SHALL allow setting, editing and removing one current override per teacher ID, with explicit current-name and original-professor fields. Names MUST be nonempty trimmed text. Removing an override SHALL restore imported presentation. Overrides SHALL have no effective dates.

#### Scenario: Correct a mixed imported name
- **WHEN** staff set current name Binotto Steven and original professor Cavallaro for d036
- **THEN** the override is saved without changing the imported Binotto Rosaria (Cavallaro) or d036

#### Scenario: Edit and remove
- **WHEN** staff edit or remove an override
- **THEN** the new labels or imported fallback appear after reload without modifying operational records

### Requirement: Consistent teacher presentation
Orari SHALL show the imported name struck through alongside the effective label when overridden. Teacher selectors, Supplenze, permit views and teacher-name exports SHALL use Current (Original). Teacher search SHALL find imported, current and original names. Historical views SHALL use the current label, with existing saved evidence preserved.

#### Scenario: Display and search
- **WHEN** d134 has current name Spillari Davide and original professor Savelli
- **THEN** selectors and exports show Spillari Davide (Savelli), both names are searchable, and Orari retains the struck-through imported label

### Requirement: Preserve identity and operational behavior
Name overrides SHALL NOT change teacher IDs, timetable content, eligibility, absence ownership, assignment keys, permit identities, RP links, balances or statistical facts. Missing overrides SHALL retain existing behavior. The editor SHALL explain that name changes do not create separate permit or recovery accounts.

#### Scenario: Existing account remains intact
- **WHEN** an override is saved, edited or removed for a teacher with linked permits and RP assignments
- **THEN** all operational records and accounting results remain equal to their prior values

### Requirement: Preserve overrides across data operations
Overrides SHALL survive restart, database backup and validated archive round trips. Imports SHALL retain overrides by ID without name-based remapping. Missing IDs SHALL retain stored overrides without becoming active choices. Legacy archives SHALL preserve current overrides whose IDs remain in restored history, and reject incompatible restore atomically rather than silently dropping overrides.

#### Scenario: Import and legacy restore
- **WHEN** a timetable changes a teacher label but preserves its ID
- **THEN** its explicit override remains attached to that ID and the imported label remains inspectable

#### Scenario: Archive safety
- **WHEN** an archive contains an invalid override reference or malformed name
- **THEN** restoration fails without partially changing application data

#### Scenario: Legacy archive omits overrides
- **WHEN** a legacy archive is restored and all existing override IDs remain in its teacher history
- **THEN** existing overrides are retained
- **AND** an incompatible retained reference instead causes an atomic rejection with an explanation
