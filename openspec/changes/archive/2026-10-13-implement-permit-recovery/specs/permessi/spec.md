# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
