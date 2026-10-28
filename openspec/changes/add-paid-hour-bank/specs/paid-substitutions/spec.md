## Purpose

Let the office maintain recurring paid substitution availability, explicitly assign paid hours and inspect their accounting, communication and theoretical staffing capacity.

## ADDED Requirements

### Requirement: Editable recurring paid availability
Banca ore SHALL show a Monday–Friday grid for periods 1–7, listing declared teachers alphabetically in each slot. An explicit edit mode SHALL allow adding and removing known active teachers per slot, without duplicates. Both accounts SHALL be able to edit these shared declarations. Invalid weekdays, periods or teacher references SHALL be rejected.

#### Scenario: Edit and reload
- **WHEN** either account adds Rossi to Monday period 3 and saves
- **THEN** Rossi appears once in that recurring slot after reload
- **AND** removing that declaration removes future candidate eligibility without deleting paid assignments

#### Scenario: Stale concurrent editing
- **WHEN** two users change the same declaration from the same baseline
- **THEN** the stale save conflicts without overwriting the first change or losing the editor's entered values

### Requirement: Visible computed availability campuses
The grid SHALL show computed campus labels beside each teacher: Centrale, Succursale, Entrambe or Sede da verificare. A reference week SHALL default to the current Europe/Rome week and be selectable; each weekday SHALL use its dated effective timetable. Declared slots SHALL remain visible when incompatible with that timetable, with an explicit unavailable reason.

#### Scenario: Timetable changes during a week
- **WHEN** an effective timetable changes on Wednesday
- **THEN** Monday and Wednesday labels use their respective timetables and the grid displays its reference dates

#### Scenario: Declared hour becomes occupied
- **WHEN** a timetable adds a lesson or reception in a declared paid slot
- **THEN** the declaration remains visible with its occupied reason and cannot authorize a paid assignment in that slot

### Requirement: Paid campus feasibility
Paid availability SHALL use the existing recovery travel constraints on both sides of the slot, with breaks at 2–3 and 4–5. It SHALL NOT require recovery debt or proximity to teaching. A free day without commitments SHALL permit both campuses. Missing campus information SHALL allow selection at either campus with Sede da verificare; a known impossible transfer SHALL remain blocked.

#### Scenario: Cross-campus travel
- **WHEN** a teacher teaches period 2 in Centrale and offers paid period 1
- **THEN** Centrale is feasible and Succursale is blocked because no break intervenes
- **AND** paid period 3 can permit Succursale if the following commitments also allow travel

#### Scenario: Both sides matter
- **WHEN** a teacher teaches periods 3 and 5 in Centrale and declares period 4
- **THEN** Succursale is blocked by the missing 3–4 break despite the 4–5 break

#### Scenario: Free day or unknown campus
- **WHEN** a teacher declares a slot on a day without commitments
- **THEN** the grid shows Entrambe and both campuses can offer the teacher
- **WHEN** a relevant teaching commitment instead has missing campus information
- **THEN** the grid and candidate entry show Sede da verificare and assignment remains selectable unless a known conflict prevents it

### Requirement: Assignment-derived paid accounting
Each saved paid substitution SHALL count as one paid hour immediately, including future assignments. Totals SHALL cover all current data, independently of notification and elapsed time. Removing or replacing a paid assignment SHALL remove its paid contribution. Availability edits, timetable changes or review flags SHALL NOT silently recategorize or erase saved paid hours.

#### Scenario: Future booking and removal
- **WHEN** a teacher has two paid assignments and receives a future paid assignment
- **THEN** their total becomes three immediately
- **AND** deleting that assignment returns the total to two

#### Scenario: Eligibility changes after assignment
- **WHEN** paid availability is removed or a timetable makes an existing assignment require review
- **THEN** its paid identity and count remain until explicitly removed or replaced

### Requirement: Paid substitution register
Below the weekly grid, Banca ore SHALL list saved paid assignments newest date first, with teacher, substitution date, period, class, campus, assigning account and notification state. It SHALL show per-teacher totals, including future assignments. Records whose current timetable context is unavailable SHALL retain readable saved context and identity.

#### Scenario: Inspect planned and past hours
- **WHEN** a teacher has one past and one future paid assignment
- **THEN** both appear with their assignment details and assigning account, and the teacher's total is two
- **AND** no separate performed/completed confirmation is required

### Requirement: Individual paid request communication
Each paid assignment SHALL expose an Avvisato toggle and a copyable request email button only in its Supplenze table row, following the permit recovery pattern. The Banca ore register SHALL NOT contain these controls. Each message SHALL ask that teacher to attend that specific paid substitution and include date, period, class, campus and room when known. Copying SHALL NOT send email or change Avvisato. Clipboard success or failure SHALL be accessible.

#### Scenario: Copy and mark independently
- **WHEN** a user copies the request from a paid substitution row in the Supplenze table
- **THEN** only that substitution appears in the message and no notification state changes
- **AND** toggling Avvisato persists after reload without changing the paid total

#### Scenario: Assignment replacement
- **WHEN** a paid assignment is replaced with a different teacher or category
- **THEN** its previous notification state does not carry into the new assignment

### Requirement: Paid operation permissions
School-wide paid declarations, register and totals SHALL be visible to both accounts. Paid assignment creation, replacement, deletion and Avvisato SHALL follow the existing server-derived target-row campus permissions. The assigning account SHALL be recorded by the server and preserved by notification-only changes and identical resaves.

#### Scenario: Wrong-campus mutation
- **WHEN** a Centrale account tries to assign or toggle Avvisato for a Succursale row
- **THEN** the server rejects it without changing any assignment or count
- **AND** the row remains inspectable with an accessible permission explanation

### Requirement: Theoretical paid Stats capacity
Stats Ore disponibili SHALL retain Disponibili and Reperibili and add Reperibili + Pagamento. The new mode SHALL count the union of ordinary availability, favourable eligible recovery opportunities and declared feasible paid slots, once per teacher per cell. It SHALL use the selected dated week, timetable and campus while preserving existing theoretical report semantics and the POT ratio.

#### Scenario: Overlapping opportunities
- **WHEN** the same teacher qualifies for recovery and paid availability in a cell
- **THEN** the new mode counts them once and its accessible breakdown identifies their qualifying categories
- **AND** Entrambe counts them once even when eligible at both campuses

#### Scenario: Operational state and uncertain campus
- **WHEN** a declared free paid slot has a daily absence or existing assignment
- **THEN** theoretical paid capacity remains visible although actual candidate eligibility applies those restrictions
- **WHEN** campus feasibility is uncertain
- **THEN** the teacher contributes to either named-campus view and once to Entrambe, with Sede da verificare disclosed

### Requirement: Portable paid data
Paid declarations, assignment categories, assigning-account metadata, notification state and saved context SHALL survive reload, backup and validated archive round trips. Older archives SHALL load with no paid declarations or invented paid assignments. Malformed paid data SHALL reject an import atomically, preserving operational data. Historical records SHALL remain readable for retired teachers.

#### Scenario: Round trip and legacy import
- **WHEN** an archive containing paid data is exported and restored
- **THEN** its declarations, assignments, totals and communication metadata remain intact
- **WHEN** a legacy archive without paid data is imported
- **THEN** it remains valid without inventing paid records

#### Scenario: Malformed paid archive
- **WHEN** an archive contains an invalid paid slot, unknown teacher reference or incompatible paid assignment metadata
- **THEN** the entire import fails without partial changes
