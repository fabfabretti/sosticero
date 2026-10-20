## Purpose

Let the office record classroom commitments during disabled POT hours and manage them through dated timetable edits.

## ADDED Requirements

### Requirement: Associate a class with disabled POT
The office SHALL be able to associate one existing class with an individually disabled POT hour through the dated timetable editor. The hour SHALL retain its POT activity and campus. Ordinary available POT hours SHALL have no such association.

#### Scenario: Add or change class
- **WHEN** the office selects an existing class for a disabled POT hour and saves the dated edit
- **THEN** the effective timetable shows both POT and the selected class for the edit's date range

#### Scenario: Reactivate POT
- **WHEN** the office reactivates a class-associated disabled POT hour
- **THEN** its class association is cleared and ordinary POT availability is restored

### Requirement: Accessible class editing
The editor SHALL offer double-click on disabled POT as a shortcut to class editing and an explicit keyboard- and touch-accessible action. Opening class editing SHALL NOT toggle availability. Cancelling SHALL preserve the previous value.

#### Scenario: Double-click shortcut
- **WHEN** the office double-clicks a disabled POT hour
- **THEN** class editing opens and the hour remains disabled

#### Scenario: Accessible alternative
- **WHEN** the office activates Associa classe using keyboard or touch
- **THEN** the same class editor opens

### Requirement: Persistent dated associations
Class associations SHALL follow existing dated override validity, reset, conflict review and assignment-impact behavior. They SHALL persist across restart and supported export/import and backup/restore flows. Existing records without associations SHALL remain valid.

#### Scenario: Outside the edit interval
- **WHEN** the effective date lies outside the association's override interval
- **THEN** the association does not affect that date's timetable or substitutions

#### Scenario: Portable association
- **WHEN** an archive containing a class-associated POT hour is exported and restored
- **THEN** the association and its dated validity are retained
