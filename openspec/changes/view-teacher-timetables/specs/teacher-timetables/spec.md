# Spec Delta

## Purpose

Provide a read-only, filterable view of the timetable currently in effect, one weekly grid per teacher, so staff can see what each teacher teaches and with whom without reading the original source schedules.

## ADDED Requirements

### Requirement: Current teacher timetable screen
The Orari screen SHALL render the timetable version currently in effect — the latest version whose effective date is not after today — as one weekly grid per active teacher. Each grid SHALL have Monday to Friday as columns and hours 1 to 7 as rows, laid out one or two grids per row.

#### Scenario: Opening the screen
- **WHEN** the user opens Orari
- **THEN** a weekly grid is shown for each active teacher with scheduled lessons

#### Scenario: Only the current version is shown
- **WHEN** more than one timetable version exists
- **THEN** only the version in effect today is rendered and its effective date is shown

#### Scenario: Teachers without lessons are omitted
- **WHEN** a teacher has no lesson in the current version
- **THEN** no grid is rendered for that teacher

### Requirement: Cell content
Each grid cell SHALL show the class taught at that day and hour, or the activity code when the hour has no class. A compresenza cell SHALL additionally list inline the names of the other teachers in the same class and hour.

#### Scenario: Lesson cell
- **WHEN** a teacher teaches class 2AST at (mer, 5)
- **THEN** that cell shows "2AST"

#### Scenario: Activity cell
- **WHEN** a teacher has an activity-only hour with code POT
- **THEN** that cell shows "POT"

#### Scenario: Compresenza cell
- **WHEN** two or more teachers teach the same class at the same day and hour
- **THEN** each of their cells shows the class and the names of the other teachers

### Requirement: Compresenza derivation
The system SHALL treat an hour as a compresenza when more than one teacher is scheduled in the same class on the same day and hour, and SHALL take the other teachers' names from that shared class-hour.

#### Scenario: Shared class-hour
- **WHEN** teachers A and B are both scheduled in class 1BST at (lun, 3)
- **THEN** A's cell lists B and B's cell lists A

#### Scenario: Three teachers share an hour
- **WHEN** three teachers are scheduled in the same class and hour
- **THEN** each of their cells lists the other two

### Requirement: Activity colors
Activity codes SHALL be displayed with the color configured for that type in Settings, so the Orari screen agrees with the candidate type badges.

#### Scenario: Configured color reused
- **WHEN** a type such as POT has a configured color
- **THEN** POT cells use that color

### Requirement: Teacher filter
The screen SHALL provide a filter that narrows the shown grids by teacher name or code, and SHALL show all active teachers when the filter is empty.

#### Scenario: Filtering by name or code
- **WHEN** the user types part of a teacher's name or code
- **THEN** only matching teachers' grids are shown

#### Scenario: Empty filter
- **WHEN** the filter is empty
- **THEN** all active teachers are shown

### Requirement: Read-only reference
The screen SHALL NOT create, modify or remove timetable data.

#### Scenario: Viewing changes nothing
- **WHEN** the user opens and filters the Orari screen
- **THEN** no request that changes stored data is made

### Requirement: Accessible grids
Each grid SHALL be a table whose day columns and hour rows are exposed as headers, so the timetable is navigable with a keyboard and readable by assistive technology.

#### Scenario: Header semantics
- **WHEN** a grid is rendered
- **THEN** its column headers name the days and its row headers name the hours
