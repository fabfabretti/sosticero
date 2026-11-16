# Spec Delta

## MODIFIED Requirements

### Requirement: Cross-campus availability communication controls
The system SHALL show Comunicato, Accettata, Rifiutata and Copy on A disposizione substitution assignments when the effective availability campus and substitution campus are both known and different. Manual and automatic availability SHALL qualify. Same-campus or unresolved-campus assignments SHALL NOT qualify.

#### Scenario: Assigned at another campus
- **WHEN** a teacher available in Centrale is assigned in Succursale
- **THEN** their substitution row exposes all four controls

#### Scenario: Same or unknown campus
- **WHEN** either campus is unknown or both campuses are the same
- **THEN** the row does not expose campus-change communication controls

## ADDED Requirements

### Requirement: Refuse the current grouped campus notice
Rifiutata on any member row SHALL refuse the entire current group of date, professor, origin and destination campus. It SHALL atomically release all member assignments and record the professor in each member row's refusal history. It SHALL preserve assignments outside that group and follow the shared substitution-refusals rules.

#### Scenario: Refuse two grouped hours
- **WHEN** an authorized operator marks Rifiutata on either of two rows in the same notice
- **THEN** both rows become unassigned and each displays the refusing professor
- **AND** unrelated rows remain unchanged

#### Scenario: Group changes before refusal saves
- **WHEN** the notice's membership, professor, hours, classes, rooms, campuses or statuses change before a refusal request using old preconditions is saved
- **THEN** the entire request is rejected without removing any assignment or recording any refusal

#### Scenario: Replace one released row
- **WHEN** a different professor is assigned to one of the released rows
- **THEN** each affected row keeps its own refusal note
- **AND** new qualifying campus notices start with their normal fresh communication and acceptance statuses
