# Spec Delta

## MODIFIED Requirements

### Requirement: Automatic availability in the sidebar
A teacher SHALL appear in A disposizione for an hour when all their scheduled classes are out and they are not absent. Computed hours SHALL remain locked and their class-out causes accessible through click-to-open information. Assignment SHALL retain the teacher in the table with the name struck through only for the assigned hour. Other hours SHALL remain editable as manual availability through the teacher's editor.

#### Scenario: Class enters later frees the compresenza teacher
- **WHEN** a class enters later and its compresenza teacher is scheduled there that hour
- **THEN** the teacher appears in that hour's table row with automatic availability
- **AND** opening the information indicator explains the class and cause

#### Scenario: Locked computed hour cannot be deselected
- **WHEN** the teacher's editor opens for a teacher with automatic and manual hours
- **THEN** computed hours cannot be toggled off and other hours remain editable

#### Scenario: Class-out cause is explained
- **WHEN** a teacher's scheduled classes are marked out for an hour
- **THEN** the information indicator beside their name in that row explains the relevant classes and causes

#### Scenario: Absent teacher is not automatically available
- **WHEN** a teacher is absent for an hour
- **THEN** they do not appear as automatically available for that hour

#### Scenario: Assigned teacher remains visible
- **WHEN** a manually or automatically available teacher is assigned in hour 2 but not hour 3
- **THEN** their name is struck through in hour 2 only and the information indicator remains readable and operable
- **AND** the assignment's class is accessible in the information for hour 2
- **AND** removing the assignment removes the strikethrough

## ADDED Requirements

### Requirement: Hour and campus availability table
The A disposizione sidebar SHALL show rows 1 through 7 and columns Ora, Centrale and Succursale. Each teacher-hour from manual or automatic availability SHALL appear once in its effective campus cell, sorted alphabetically by displayed teacher name. Empty cells SHALL show an em dash. Existing manual campus overrides SHALL take precedence over the hour's timetable campus; unresolved campuses SHALL be Sconosciuto.

#### Scenario: Manual and automatic availability overlap
- **WHEN** one teacher has manual and automatic availability for the same hour
- **THEN** their name appears once in that hour's effective campus cell

#### Scenario: Campus varies by hour
- **WHEN** automatic availability has a known timetable campus that differs between hours
- **THEN** the teacher appears in each hour's corresponding campus column
- **AND** an applicable explicit manual campus overrides the timetable campus

#### Scenario: Empty and sorted cells
- **WHEN** the table is displayed
- **THEN** all seven hour rows are present, populated cells list names alphabetically, and empty cells contain an em dash

### Requirement: Conditional unknown campus column
The table SHALL include Sconosciuto after Succursale if and only if at least one displayed teacher-hour for the selected day has an unresolved campus. When present, it SHALL span all seven rows, with an em dash in empty cells. Assigned teachers SHALL count toward its visibility.

#### Scenario: Unknown campus exists
- **WHEN** one displayed teacher has an unknown campus in hour 4 only
- **THEN** Sconosciuto appears for the entire table with that teacher in row 4 and em dashes elsewhere

#### Scenario: All campuses resolved
- **WHEN** no displayed teacher-hour has an unknown campus, including after editing or changing the day
- **THEN** Sconosciuto is absent

### Requirement: Availability information and editing access
Names in the table SHALL provide keyboard-accessible entry to the teacher's existing availability editing actions, including hours, campus, manual removal and attachments. Information indicators SHALL retain click-to-toggle notes and attachment links with keyboard, touch and Escape support. Opening information SHALL NOT open the editor or change data.

#### Scenario: Edit from a table name
- **WHEN** a user activates a teacher name
- **THEN** they can edit manual hours and campus, edit an eligible manual attachment, or remove manual availability while automatic hours remain protected

#### Scenario: Open information independently
- **WHEN** a user activates the information indicator beside a teacher name
- **THEN** the information opens with relevant causes and any saved attachment link
- **AND** no editor opens and no availability changes
