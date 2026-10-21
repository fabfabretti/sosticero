## Purpose

Help users interpret the historical Stats measures correctly while preserving the existing absence and class demand calculations.

## ADDED Requirements

### Requirement: Visible explanation of different hour units
Stats SHALL retain Ore docenti assenti and explain near the summary that absences include activities without a class to replace and co-absent teachers count separately while a class-period counts once. Class demand SHALL be labelled Ore da coprire. Historical calculations SHALL remain unchanged.

#### Scenario: Absence without substitution demand
- **WHEN** an absent teacher has POT hours without classes and teaching hours requiring substitution
- **THEN** the teacher-hour metric remains unchanged and visible copy explains why it exceeds class demand

#### Scenario: Demand without valid coverage
- **WHEN** class demand includes pending, explicitly uncovered, late-entry or early-exit outcomes
- **THEN** the summary shows Ore da coprire without a covered-hours card or coverage percentage and identifies outcomes as potentially incomplete

#### Scenario: Shared class absence
- **WHEN** two teachers are absent in the same class-period
- **THEN** the UI explains why two teacher-hours can correspond to one class-hour


### Requirement: Incomplete coverage summary
The summary SHALL omit Ore coperte and its percentage because coverage records can be incomplete across instances. Recorded outcomes SHALL remain separate with an incompleteness caveat.

#### Scenario: Separate operational instances
- **WHEN** one campus handles substitutions in a separate instance
- **THEN** the summary avoids presenting a coverage percentage from the incomplete local records
