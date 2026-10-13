## ADDED Requirements

### Requirement: Explicit uncovered outcome
Supplenze SHALL offer Scoperta for a class-period with absent teachers when no substitute was found. It SHALL be visibly distinct from pending, teacher cover and entry/exit. Selecting Scoperta SHALL NOT mark the class out or release other teachers. Users SHALL be able to replace or clear it. Merged rows SHALL carry one outcome.

#### Scenario: Emergency uncovered period
- **WHEN** the office marks a merged absence row Scoperta
- **THEN** that class-period has one saved uncovered outcome after reload
- **AND** the class remains present and other teachers' availability is unchanged

#### Scenario: Substitute subsequently found
- **WHEN** the office replaces Scoperta with an eligible substitute
- **THEN** the period is covered and no longer counted uncovered

#### Scenario: Clear the outcome
- **WHEN** the office clears Scoperta
- **THEN** the period becomes pending rather than remaining uncovered

### Requirement: Uncovered archive compatibility
Explicit uncovered outcomes SHALL survive archive export/import and database backup/restore. Imports SHALL reject invalid outcome values atomically. Existing archives without uncovered outcomes SHALL remain accepted and unassigned rows SHALL remain pending.

#### Scenario: Legacy unassigned row
- **WHEN** an existing archive with an absence and no assignment is imported
- **THEN** its derived row is pending and is not inferred to be uncovered
