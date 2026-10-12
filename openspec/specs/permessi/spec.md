# permessi Specification

## Purpose

Let the office record hourly teacher leave and use it consistently in daily substitution planning while preserving the hours still owed for future recovery.

## Requirements

### Requirement: Permit register
The Permessi screen SHALL show one record per teacher/date with Docente, Data permesso, optional Data richiesta, Ore di permesso and Ore da recuperare. The compact entry form SHALL sit in a left sidebar beside the table on desktop. Warning and error areas SHALL reserve space so controls do not shift. Users SHALL be able to add, edit and delete records. Ore da recuperare SHALL equal the number of recorded periods until recovery accounting is implemented.

#### Scenario: Record two periods
- **WHEN** the user records Contartase on 2026-10-12 for periods 2 and 3
- **THEN** the table shows the teacher, date, both periods and 2 ore da recuperare
- **AND** the record remains after reloading

#### Scenario: Edit or delete a record
- **WHEN** the user changes a permit's periods or deletes it
- **THEN** the register and the affected day's derived absences reflect the saved change

#### Scenario: Existing teacher and date
- **WHEN** the user adds a permit for a teacher/date already recorded
- **THEN** the application directs the user to edit the existing record rather than creating a duplicate

### Requirement: Daily permit limit
The form SHALL immediately show warning triangles for selected periods when their total exceeds the daily limit and disable saving until corrected. The system SHALL reject saves exceeding floor(the teacher's scheduled periods on that weekday / 2). Every scheduled activity SHALL count, including lessons, POT and DIS; each period SHALL count once. Unscheduled permit periods SHALL count toward the limit.

#### Scenario: Even and odd daily loads
- **WHEN** a teacher has 4, 5 or 6 scheduled periods
- **THEN** the corresponding daily permit limits are 2, 2 and 3
- **AND** saving more than the applicable limit is rejected without changing stored data

#### Scenario: Mixed activities
- **WHEN** a teacher has two lessons, one POT period and one DIS period
- **THEN** the daily limit is two periods

#### Scenario: No scheduled activity that day
- **WHEN** a teacher has no scheduled periods on the selected day
- **THEN** a nonempty permit is rejected because the daily limit is zero

### Requirement: Unscheduled period warning
Selecting a permit period with no scheduled activity SHALL show a warning beside that period. The icon SHALL appear below or above its period without shifting the hour row. Its explanation SHALL be available on hover and keyboard focus. The warning SHALL NOT prevent saving within the daily limit and SHALL also appear on saved records containing unscheduled periods.

#### Scenario: Warning permits saving
- **WHEN** a teacher has five scheduled periods and the user selects two unscheduled periods
- **THEN** each selected period shows a warning explaining that no activity is scheduled
- **AND** the user can save the two-period permit

### Requirement: Validate permit input
The system SHALL require a known teacher, valid date and nonempty list of distinct integer periods within the supported timetable. Invalid requests SHALL fail without changing stored data. New records SHALL use active teachers; historical records SHALL remain readable if a teacher is retired.

#### Scenario: Invalid periods
- **WHEN** a request contains duplicate periods, booleans, out-of-range periods or an unknown teacher
- **THEN** the request is rejected and existing records remain unchanged

### Requirement: Permit-derived absences
Supplenze SHALL use the union of manual absence hours and permit hours for rows, candidate eligibility, assignment validation and automatic availability. Permit hours SHALL appear selected and locked in Assenti with a Permesso explanation available on hover and keyboard focus. Other hours SHALL remain editable as manual absences.

#### Scenario: Permit creates substitution needs
- **WHEN** Contartase has a permit for periods 2 and 3 on 2026-10-12
- **THEN** both hours appear selected and locked in Assenti for that date
- **AND** scheduled classes produce substitution rows under existing grouping rules
- **AND** Contartase cannot be assigned in those periods or become automatically available

#### Scenario: Manual overlap survives deletion
- **WHEN** period 2 is both manually absent and covered by a permit and the permit is deleted
- **THEN** period 2 remains manually absent and becomes editable

#### Scenario: Remove manual entry
- **WHEN** the user removes a manual absence for a teacher who also has permit hours
- **THEN** the permit hours remain absent and locked

#### Scenario: Existing assignment becomes invalid
- **WHEN** a permit makes a previously assigned substitute absent
- **THEN** the existing assignment is retained and flagged for review under the existing issue flow

### Requirement: Permit archive compatibility
Permits SHALL survive database backups and validated archive export/import. Archives without permit records SHALL remain importable as having no permits. Malformed permit data SHALL cause the entire import to fail atomically. Historical permits SHALL NOT be removed or rewritten when the timetable changes.

#### Scenario: Round trip
- **WHEN** data containing permits is exported and imported into a compatible dataset
- **THEN** permit dates, teacher references and periods are preserved

#### Scenario: Legacy archive
- **WHEN** a compatible older archive has no permit field
- **THEN** it imports with an empty permit register

#### Scenario: Timetable changed after recording
- **WHEN** a later timetable reduces the teacher's daily scheduled hours
- **THEN** existing permits remain readable and importable without reapplying the new daily limit to historical records

#### Scenario: Malformed archive
- **WHEN** an imported permit has an invalid date, teacher reference or period list
- **THEN** the import fails and the previous state remains intact

### Requirement: Optional request date
Users SHALL be able to record, edit or clear the date a permit was requested. The date SHALL be optional, shown in the register when provided and preserved by archive import/export and database backup. Older records without it SHALL remain valid.

#### Scenario: Request date survives editing
- **WHEN** a permit is saved with request date 2026-10-09
- **THEN** the register and edit form show that date after reload and archive round trip
- **AND** clearing it leaves the permit valid


### Requirement: Sort the permit register by dates
The register SHALL initially show permits by descending permit date. The permit date and request date column headers SHALL allow selecting the sort field and toggling ascending or descending order, with the current direction exposed visually and accessibly. Permits without a request date SHALL remain last when sorting by request date in either direction.

#### Scenario: Toggle permit date ordering
- **WHEN** the user activates the permit date header
- **THEN** the register switches between oldest-first and newest-first order

#### Scenario: Sort optional request dates
- **WHEN** the user activates the request date header
- **THEN** the register sorts by request date, initially newest-first
- **AND** subsequent activations reverse the direction
- **AND** permits without a request date remain last
