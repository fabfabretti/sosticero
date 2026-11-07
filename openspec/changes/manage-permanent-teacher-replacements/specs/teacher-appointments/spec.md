## Purpose

Manage continuous teacher absences and full-cattedra replacements while keeping personal identity separate from dated timetable ownership.

## ADDED Requirements

### Requirement: Stable people and timetable sources
The system SHALL identify each person separately from their imported timetable source. Names SHALL be editable labels. Personal records SHALL retain their owner when timetable coverage changes. Existing correct identities SHALL remain unchanged.

#### Scenario: Existing correct replacement
- **WHEN** an already correctly attributed teacher such as Benedetti is retained during upgrade
- **THEN** their records, identity and balances remain unchanged

### Requirement: Dated prolonged absence
Administrators SHALL record a person's prolonged absence with a start date and optional inclusive end date. An omitted end SHALL mean ongoing. Prolonged absence SHALL remain independent of replacement coverage.

#### Scenario: Unfilled absence
- **WHEN** Ianzano is absent for a prolonged period and no replacement covers his timetable
- **THEN** his scheduled daily commitments produce automatic absence needs throughout the period

### Requirement: Dated full-cattedra coverage
Administrators SHALL assign an existing or newly created person to a timetable source for a start date and optional inclusive end date. Successive replacements SHALL reference the same underlying source. Overlapping coverage of a source and conflicting simultaneous schedules for a person SHALL be rejected atomically.

#### Scenario: Successive replacements
- **WHEN** Sicoli's coverage ends and a third person begins on the following day
- **THEN** the new person receives the same source timetable for their period
- **AND** both replacements retain their own historical records

#### Scenario: Boundary and overlap
- **WHEN** a new appointment starts on another appointment's inclusive end date
- **THEN** saving fails without changing either appointment

### Requirement: Effective inheritance excludes POT
Active replacements SHALL inherit all source timetable hours except POT, preserving classes, rooms, campuses and other activities. Excluded POT SHALL yield neither inherited commitments nor demand for the original during coverage. Timetable revisions and applicable overrides SHALL be resolved for the selected date before inheritance.

#### Scenario: Complete inheritance with POT removal
- **WHEN** Gambato's timetable includes lessons, DIS, PE and POT during Sicoli's coverage
- **THEN** Sicoli receives lessons, DIS and PE with their original context
- **AND** POT is absent from Sicoli's schedule; mixed periods retain their non-POT components
- **AND** no original-teacher demand or POT availability is created by those excluded periods

#### Scenario: Revised timetable
- **WHEN** a compatible timetable revision changes the source's room or lesson during coverage
- **THEN** the replacement's effective timetable reflects the change from its effective date

### Requirement: Administration management
Amministrazione SHALL provide admin-only controls for creating people, selecting inherited cattedre, managing prolonged absences and editing or ending replacement periods. Its save preview SHALL expose inherited hours, excluded POT and affected saved records. The workflow SHALL NOT require Orari access.

#### Scenario: Review Sicoli's coverage
- **WHEN** an administrator previews Sicoli replacing Gambato in Amministrazione
- **THEN** the preview identifies the active and original people, inherited timetable, omitted POT and affected records before saving
- **AND** the administrator can complete the workflow without opening Orari

#### Scenario: Operational account cannot manage staffing
- **WHEN** a non-admin attempts a staffing management request directly
- **THEN** the server denies the request without changing records

### Requirement: Orari appointment visibility
Orari SHALL display dated staffing status without staffing write controls. Absent originals SHALL appear greyed, covered original names struck through beside clear replacement names, and excluded source POT crossed out with “POT non ereditato”. Readable labels SHALL explain the visual states. Excluded POT SHALL remain outside the effective schedule.

#### Scenario: Operational timetable view
- **WHEN** an operational user views Sicoli's timetable during coverage
- **THEN** Gambato's original name is struck through beside Sicoli's clear name, with explicit coverage labels
- **AND** excluded source POT is crossed out and labelled without contributing commitments or availability
- **AND** no staffing management controls are available

#### Scenario: Unfilled prolonged absence
- **WHEN** Orari shows Ianzano during his uncovered prolonged absence
- **THEN** his teacher card is greyed with an explicit prolonged-absence label and his timetable remains inspectable

### Requirement: Prolonged absence list and contextual assignment
Amministrazione SHALL open staffing management on Assenze prolungate, listing active absent teachers, dates and replacement status. Uncovered absences SHALL offer Assegna supplente with the original cattedra already selected. Future and ended periods SHALL remain inspectable. Daily absences SHALL remain in Supplenze.

#### Scenario: Assign from an absent teacher
- **WHEN** an administrator selects Assegna supplente beside an uncovered prolonged absence
- **THEN** the form already identifies the original teacher and their cattedra
- **AND** no combined absence/replacement operation selector is shown

### Requirement: Search selection and teacher profiles
Teacher selection SHALL use the existing suggestion-based search interaction with explicit selection and keyboard navigation. Administrators SHALL be able to add a replacement person inline. Classe di concorso selection SHALL display code and description together and persist the selected code. School-specific reconciliation controls SHALL NOT appear in staffing management.

#### Scenario: Pick a class of concorso
- **WHEN** an administrator searches for A041 or informatiche while adding a person
- **THEN** suggestions show A041 and Scienze e tecnologie informatiche together
- **AND** selecting it stores A041

### Requirement: Protected appointment corrections
Changes affecting saved activity SHALL show impacted records and SHALL NOT silently reassign, delete or invalidate them. Unresolved conflicts SHALL reject the change atomically. Stale concurrent edits SHALL require refresh. Ending coverage SHALL preserve history and restore the original timetable from the following day, subject to continued absence.

#### Scenario: Backdated correction
- **WHEN** shortening coverage conflicts with a saved assignment for the replacement
- **THEN** saving fails with references to the affected activity and leaves all data unchanged

#### Scenario: Ongoing original absence after expiry
- **WHEN** coverage ends while the original remains absent for a prolonged period
- **THEN** uncovered daily demand resumes on the next date

### Requirement: Preserved cover and conflicting assignments
Existing absences and assignments covering the absent person SHALL be presented as preserved information, without a review checkbox. An assignment performed by that person during the proposed absence SHALL remain a visible blocking conflict, including when an existing manual absence already made it invalid.

#### Scenario: Existing colleagues cover the absent teacher
- **WHEN** an administrator adds Ianzano's prolonged absence over dates with existing absences and colleagues covering her classes
- **THEN** those records remain unchanged and are shown as preserved information identifying Ianzano and each covering colleague
- **AND** no review checkbox is required merely because those records exist

#### Scenario: Absent teacher covers another person
- **WHEN** Ianzano is assigned to cover another person's class during the proposed absence period
- **THEN** the preview identifies her assignment, date, class and hour as a blocking conflict
- **AND** it remains visible even if a manual absence already made the assignment invalid

### Requirement: Identity-safe imports and matching
Imports SHALL preserve source mappings and appointments for compatible identities. Missing, renumbered or conflicting sources SHALL require explicit reconciliation before application. Name matching SHALL NOT silently conflate original and replacement people; ambiguous Inbox items or date ranges crossing ownership boundaries SHALL require review.

#### Scenario: Original-name submission
- **WHEN** an Inbox item names Gambato during Sicoli's coverage and its intended person is ambiguous
- **THEN** the item requires explicit person selection rather than automatically recording Sicoli's absence

### Requirement: Portable appointment state
People, mappings, absence periods and appointments SHALL survive reload, backups and archive round trips. Legacy archives SHALL remain importable without inferred replacements. Invalid references, overlapping periods and malformed records SHALL reject import atomically. Compatible accounts SHALL retain existing read/write restrictions.

#### Scenario: Round trip
- **WHEN** an archive with successive replacements and separate personal debt is exported and restored
- **THEN** dated ownership and all personal balances remain identical

#### Scenario: Invalid archive
- **WHEN** an imported appointment references a missing person
- **THEN** import fails without changing saved state
