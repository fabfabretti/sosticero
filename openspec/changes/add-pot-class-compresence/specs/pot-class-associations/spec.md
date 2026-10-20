## Purpose

Let the office record classroom commitments during disabled POT hours and manage them through dated timetable edits.

## ADDED Requirements

### Requirement: Associate a class with disabled POT
The office SHALL be able to associate one existing class with an individually disabled POT hour through the dated timetable editor. The hour SHALL retain its POT activity; the office SHALL be able to set its campus to Centrale or Staccata. Ordinary available POT hours SHALL have no such association.

#### Scenario: Add or change class
- **WHEN** the office selects an existing class for a disabled POT hour and saves the dated edit
- **THEN** the effective timetable shows both POT and the selected class for the edit's date range

#### Scenario: Reactivate POT
- **WHEN** the office reactivates a class-associated disabled POT hour
- **THEN** its class association is cleared and ordinary POT availability is restored

### Requirement: Accessible class editing
In timetable edit mode only, clicking or double-clicking a POT cell SHALL open its class and campus editor. A separate keyboard- and touch-accessible control SHALL toggle availability. Opening class editing SHALL NOT toggle availability. Cancelling SHALL preserve the previous value.

#### Scenario: Double-click shortcut
- **WHEN** the office double-clicks a disabled POT hour in timetable edit mode
- **THEN** class editing opens and the hour remains disabled

#### Scenario: Accessible alternative
- **WHEN** the office activates Modifica POT using keyboard or touch
- **THEN** the same class editor opens

### Requirement: Persistent dated associations
Class associations SHALL follow existing dated override validity, reset, conflict review and assignment-impact behavior. They SHALL persist across restart and supported export/import and backup/restore flows. Existing records without associations SHALL remain valid.

#### Scenario: Outside the edit interval
- **WHEN** the effective date lies outside the association's override interval
- **THEN** the association does not affect that date's timetable or substitutions

#### Scenario: Portable association
- **WHEN** an archive containing a class-associated POT hour is exported and restored
- **THEN** the association and its dated validity are retained

### Requirement: Visible future overrides
Saved future overrides SHALL be expanded by default and remain listed while editing the teacher timetable. The office SHALL be able to delete them through the existing reviewed deletion flow; discarding a current draft SHALL require explicit confirmation.

#### Scenario: Delete a future override while editing
- **WHEN** the office edits a teacher with a future override
- **THEN** that override remains visible with its delete action
- **AND** deletion confirms discarding the draft before applying the reviewed removal

### Requirement: ALF classroom commitments
ALF hours SHALL support the same dated class association, campus editing, separate availability toggle, class-out release and absence-row behavior as POT. Their activity code SHALL remain ALF. Same-class coverage SHALL be normally selectable as Compresenza - ALF and retain that label in saved assignments, exports and statistics. Other activity codes SHALL retain their existing behavior.

#### Scenario: Edit ALF in timetable edit mode
- **WHEN** the office clicks or double-clicks an ALF cell while editing a timetable
- **THEN** its class and campus editor opens without toggling availability

#### Scenario: Cover the associated class with ALF
- **WHEN** an eligible teacher has disabled ALF associated with the uncovered class that period
- **THEN** the teacher is normally assignable as Compresenza - ALF

### Requirement: Compact activity editing dialog
POT and ALF class/campus editing SHALL open a compact modal dialog outside the timetable grid, without changing cell dimensions. Class input SHALL filter suggestions using the Supplenze search interaction and support keyboard selection. Campus SHALL use three buttons (Centrale, Staccata, Non indicata), with exactly one highlighted. Escape and cancellation SHALL discard only the dialog draft.

#### Scenario: Search and select a class
- **WHEN** the office types a class name in the activity editor
- **THEN** matching class suggestions appear and can be chosen by click or keyboard
- **AND** unselected search text cannot be applied as a class

#### Scenario: Change campus without expanding a cell
- **WHEN** the office opens the dialog and selects Staccata
- **THEN** only Staccata is highlighted and the timetable cell retains its dimensions
