# Spec Delta

## MODIFIED Requirements

### Requirement: Permit register
The Permessi screen SHALL show one record per teacher/date with Docente, Data permesso, optional Data richiesta, Ore di permesso and Ore da recuperare. The compact entry form SHALL sit in a left sidebar beside the table on desktop. Warning and error areas SHALL reserve space so controls do not shift. Users SHALL be able to add, edit and delete records. The register SHALL also show Sede lezioni, Inserito da and Dettaglio recuperi with dates and periods, omitting Scadenza recupero and Ore recuperate columns. Recovery deadlines SHALL remain enforced. Ore da recuperare SHALL equal recorded periods minus linked RP assignments. Teachers with outstanding hours SHALL be highlighted, with expired outstanding hours explicitly marked Scadute. Records whose individual Ore da recuperare is zero SHALL have their data struck through while their actions remain usable.

#### Scenario: Record two periods
- **WHEN** the user records Contartase on 2026-10-12 for periods 2 and 3
- **THEN** the table shows the teacher, date, both periods and 2 ore da recuperare
- **AND** the record remains after reloading

#### Scenario: Edit or delete a record
- **WHEN** the user validly changes a permit's periods or deletes a permit with no linked recoveries
- **THEN** the register and the affected day's derived absences reflect the saved change

#### Scenario: Existing teacher and date
- **WHEN** the user adds a permit for a teacher/date already recorded
- **THEN** the application directs the user to edit the existing record rather than creating a duplicate

#### Scenario: Completed individual permit
- **WHEN** one permit has zero hours remaining and another permit for the same teacher still has outstanding hours
- **THEN** only the completed permit's data is struck through
- **AND** its permitted actions remain usable

#### Scenario: Compact register columns
- **WHEN** the permit register is displayed
- **THEN** Sede lezioni and Inserito da are shown as separate columns
- **AND** Scadenza recupero and Ore recuperate are absent while recovery details and remaining hours remain visible

## ADDED Requirements

### Requirement: Permit creator campus
New dated permits SHALL automatically record the authenticated creator's campus as Inserito da. Ordinary clients SHALL NOT select or overwrite it. Valid edits, including moves to another date or teacher, SHALL preserve it even when made by the other campus. Older records SHALL remain unspecified, including after editing. Deleting a permit SHALL remove its provenance.

#### Scenario: Cross-campus editing
- **WHEN** Succursale creates a permit and Centrale later edits or moves it
- **THEN** Inserito da remains Succursale

#### Scenario: Legacy provenance remains unspecified
- **WHEN** a permit without creator metadata is loaded or edited
- **THEN** Inserito da remains unspecified without inferring a campus

### Requirement: Portable permit creator campus
Creator-campus metadata SHALL survive reload, backup and archive round trips. Archives without it SHALL remain valid with unspecified provenance. Invalid campus values or metadata referring to a missing permit SHALL reject archive import atomically.

#### Scenario: Provenance round trip
- **WHEN** a permit with recorded creator campus is exported and imported
- **THEN** its creator campus is preserved

#### Scenario: Invalid provenance archive
- **WHEN** an archive contains an unknown creator campus or provenance without a permit
- **THEN** import fails without changing existing records

### Requirement: Weekly teaching campus display
Sede lezioni SHALL show the campuses of the teacher's lessons across the whole weekly timetable effective on the permit date, rather than just the permit weekday or hours. It SHALL show both campuses when applicable and an unspecified value when none is known.

#### Scenario: Weekly campuses differ from permit day
- **WHEN** a teacher teaches at Centrale on the permit day and at Succursale elsewhere in that week's effective timetable
- **THEN** Sede lezioni shows both Centrale and Succursale

#### Scenario: Later timetable version
- **WHEN** a later effective timetable changes a teacher's campuses
- **THEN** an earlier permit continues using the timetable version effective on its own date

### Requirement: Accessible campus tags
Sede lezioni and known Inserito da values SHALL use campus tags with existing Centrale and Succursale colours. Compact C/S labels SHALL expose full campus names accessibly and on hover. Colour SHALL NOT be the only way to distinguish campuses. Both teaching campuses SHALL appear as separate tags.

#### Scenario: Compact tags
- **WHEN** compact campus tags are displayed
- **THEN** C identifies Centrale and S identifies Succursale with full names available to assistive technology and on hover
