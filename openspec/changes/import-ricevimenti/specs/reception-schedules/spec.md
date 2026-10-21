# Reception Schedules

## Purpose

Maintain dated teacher reception commitments independently of teaching timetables, with reviewed identity matching and explicit location uncertainty.

## ADDED Requirements

### Requirement: Reception spreadsheet preview
Settings SHALL provide a Ricevimenti section accepting XLSX files with docente, giorno and ora columns, preserving optional orario and luogo. Preview SHALL show parsed rows, source names, selected teachers, locations, skipped rows and validation errors before confirmation. Invalid input SHALL leave saved data unchanged.

#### Scenario: Supplied spreadsheet layout
- **WHEN** a workbook uses the supplied Table1 layout with weekday abbreviations and period numbers
- **THEN** the preview reads receptions without treating class lists or parent counts as timetable commitments

#### Scenario: Invalid row
- **WHEN** a row has an invalid weekday or unsupported period
- **THEN** preview identifies the source row and prevents confirmation until corrected or explicitly skipped

### Requirement: Reviewed teacher matching
Automatic matching SHALL require a unique normalized full-name match against imported names or configured teacher names. Uncertain matches SHALL remain unresolved with searchable manual teacher selection. Every row SHALL be matched or explicitly skipped before saving. Saved receptions SHALL reference stable teacher identities rather than names.

#### Scenario: Ambiguous name
- **WHEN** multiple teachers match or a name only has an approximate match
- **THEN** suggestions are shown but no teacher is silently selected
- **AND** the user can select an existing active teacher or skip the row

#### Scenario: Renamed teacher
- **WHEN** a matched teacher later changes display name
- **THEN** their receptions remain associated with the same identity

### Requirement: Explicit reception locations
Reception campuses SHALL accept centrale, succursale or unknown. Blank locations and a distanza SHALL remain unknown unless manually confirmed. Original location text SHALL remain visible. Nearby lessons MAY supply suggestions, but suggestions SHALL NOT establish confirmed campus feasibility without user confirmation.

#### Scenario: Blank and remote locations
- **WHEN** a reception has no luogo or has luogo a distanza
- **THEN** it imports with unknown campus and retains its original location description
- **AND** campus selection remains optional

### Requirement: Dated atomic reception updates
Each import SHALL replace the complete reception schedule from its selected effective date until the next reception version. Before the first effective date there SHALL be no receptions. Preview SHALL disclose affected existing assignments. Confirmation SHALL reject stale previews and save atomically after a verified backup, preserving assignments and recovery links while flagging new conflicts.

#### Scenario: Later schedule
- **WHEN** a new reception schedule starts on November 2
- **THEN** earlier dates keep their previous reception schedule independently of teaching timetable imports

#### Scenario: Existing RP collision
- **WHEN** a confirmed import places R over an existing RP assignment
- **THEN** the assignment and permit attribution remain stored and are flagged for review

### Requirement: Reception display in Orari
Orari SHALL show R in the teacher's reception cells for the viewed date, with accessible weekday, period, time and location details. Reception overlays SHALL preserve underlying lessons and visibly flag overlaps. Editing teaching timetables SHALL NOT move or erase receptions.

#### Scenario: Reception overlaps a lesson
- **WHEN** R and a lesson occupy the same teacher cell
- **THEN** both remain visible with an overlap warning

### Requirement: Reception portability
Database backups and portable archives SHALL preserve reception versions, teacher mappings and confirmed locations. Legacy archives without receptions SHALL restore an empty reception schedule. Invalid reception data or dangling teacher references SHALL reject archive restoration atomically.

#### Scenario: Round trip and invalid references
- **WHEN** reception data is exported and restored
- **THEN** dated behavior and teacher references remain equivalent
- **AND** an archive referencing an unknown teacher is rejected without partial writes

### Requirement: Reception-aware availability statistics
Timetable availability statistics SHALL exclude R periods from RP opportunities and count adjacent RP opportunities only when confirmed favorable under the same campus rules used for candidate selection. R SHALL NOT add teaching hours or disposable activity hours to existing totals.

#### Scenario: Unknown campus opportunity
- **WHEN** an otherwise free period is adjacent only to a reception with unknown campus
- **THEN** it is excluded from confirmed favorable RP counts
