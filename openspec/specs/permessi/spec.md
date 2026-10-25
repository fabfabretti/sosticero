# permessi Specification

## Purpose

Let the office record hourly teacher leave and use it consistently in daily substitution planning while preserving the hours still owed for future recovery.

## Requirements

### Requirement: Permit register
The Permessi screen SHALL show one record per teacher/date with Docente, Data permesso, optional Data richiesta, Ore di permesso and Ore da recuperare. The compact entry form SHALL sit in a left sidebar beside the table on desktop. Warning and error areas SHALL reserve space so controls do not shift. Users SHALL be able to add, edit and delete records. The register SHALL also show the recovery deadline, numeric Ore recuperate and Dettaglio recuperi with dates and periods. Ore da recuperare SHALL equal recorded periods minus linked RP assignments. Teachers with outstanding hours SHALL be highlighted, with expired outstanding hours explicitly marked Scadute.

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

### Requirement: Calendar-month recovery deadline
Each permit SHALL expire one calendar month after its permit date, clamped to the target month's last day. Recovery SHALL be allowed through the deadline date inclusive, using the substitution date. Expiration SHALL preserve outstanding debt and history but prevent new recovery against that permit.

#### Scenario: Month-end and leap year
- **WHEN** permits are dated 2027-01-31 and 2028-01-31
- **THEN** their deadlines are 2027-02-28 and 2028-02-29 respectively

#### Scenario: Inclusive deadline and retrospective entry
- **WHEN** a permit dated 2026-10-12 funds a substitution dated 2026-11-12, entered later
- **THEN** the date qualifies, while 2026-11-13 does not
- **AND** an expired outstanding balance remains visible

### Requirement: Permanent oldest-first recovery attribution
Each RP assignment SHALL recover exactly one hour from the oldest permit for its teacher with remaining capacity and a valid date window. Attribution SHALL remain fixed after saving. Balances and recovery details SHALL derive from linked assignments, including future scheduled assignments as reserved recoveries; outstanding totals SHALL distinguish expired from date-eligible hours.

#### Scenario: Multiple permits
- **WHEN** two permits qualify and the older has one remaining hour
- **THEN** the next RP assignment links to the older permit and the following assignment uses the newer permit

#### Scenario: Backdated permit does not move history
- **WHEN** an older permit is added after an RP assignment was saved
- **THEN** the existing assignment retains its original permit link

#### Scenario: Future assignment reserves capacity
- **WHEN** the final available hour is assigned to a future substitution within the permit window
- **THEN** it is counted and dated in recovery details and cannot fund another assignment

### Requirement: Stable identity and protected permit edits
A permit SHALL retain its identity through valid edits. The system SHALL reject deleting a recovered permit, changing its teacher, reducing its hours below linked recoveries, or changing its date so a linked recovery falls outside its valid window. Failed edits SHALL leave all records unchanged.

#### Scenario: Protected linked permit
- **WHEN** a permit with two recovered hours is reduced to one hour or deleted
- **THEN** the edit is rejected with an explanation requiring resolution of its RP assignments first

#### Scenario: Valid date edit
- **WHEN** a permit date changes and all linked recovery dates remain within the resulting window
- **THEN** its identity and links remain unchanged and its derived deadline updates

### Requirement: Recovery portability and legacy migration
Stable permit identities and RP links SHALL survive reload, backup and archive round trips. Existing permits SHALL receive persistent identities without losing periods or request dates. Legacy archives without recoveries SHALL remain importable. Dangling links, wrong-teacher links, non-RP links, out-of-window recoveries and over-recovery SHALL reject import atomically.

#### Scenario: Legacy migration is repeatable
- **WHEN** existing data is migrated and the app restarts again
- **THEN** permit identities remain the same and no recoveries are invented

#### Scenario: Invalid recovery archive
- **WHEN** an archive references a missing permit or allocates more hours than it contains
- **THEN** import fails without changing operational state

### Requirement: Optional permit classification
The compact Permessi entry and edit form SHALL provide mutually exclusive Programmata and Last minute toggle buttons, allowing neither. Pressing the active button SHALL clear the choice. New forms SHALL initially be unspecified; after creating a permit the choice SHALL remain set for subsequent entries during the mounted page session. Editing SHALL load the saved choice. Classification SHALL NOT alter permit limits, recovery identity or accounting.

#### Scenario: Record and edit classification
- **WHEN** a programmed permit is saved and reopened for editing
- **THEN** Programmata is selected
- **AND** the user can switch to Last minute or clear the choice

#### Scenario: Repeated entry
- **WHEN** a permit with Last minute selected is successfully created
- **THEN** Last minute stays selected for the next new permit

### Requirement: Portable permit classification
Permit classification SHALL survive reload, database backup, archive import/export and valid permit moves to another date or teacher. Missing metadata SHALL mean unspecified without inference from request dates. Deletion SHALL remove associated classification. Invalid values or classification referencing a missing permit SHALL reject changes atomically. Updates omitting classification SHALL preserve it; explicit clearing SHALL remove it.

#### Scenario: Legacy data
- **WHEN** existing permit data without classification is loaded or imported
- **THEN** it remains valid and unspecified

#### Scenario: Move and round trip
- **WHEN** a classified permit is validly moved to another date and exported then imported
- **THEN** classification follows that permit and no metadata remains at its previous location

#### Scenario: Malformed import
- **WHEN** an archive has an invalid permit classification or classification without a permit
- **THEN** the complete import fails without modifying existing records

### Requirement: Classified permits participate in sidebar grouping
Permit-derived teacher absences SHALL participate in the same daily sidebar grouping as manual absences. Any Last minute source SHALL take precedence over Programmata and unspecified, and Programmata SHALL take precedence over unspecified. The teacher SHALL appear only once with the union of absent hours, retaining locked permit hours and their explanations.

#### Scenario: Last-minute permit takes precedence
- **WHEN** a teacher has a last-minute permit and a programmed manual absence that day
- **THEN** the teacher appears once under Assenze last minute with the combined absent hours

#### Scenario: Permit-only absence
- **WHEN** a programmed permit is the teacher's only absence source
- **THEN** the teacher appears under Assenze programmate with its permit hours locked
