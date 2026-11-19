## MODIFIED Requirements

### Requirement: Absence type composition
Andamento SHALL show a pie chart for recorded classified absence types, including Programmata, Last minute, In gita, In sciopero and In assemblea, weighted by absent teacher-hours in the selected campus and period. Each unique absent teacher-period SHALL contribute once. The pie SHALL exclude Non classificata and use classified hours as its denominator. Missing classifications SHALL remain Non classificata without timing-based inference.

#### Scenario: Classified and unclassified hours
- **WHEN** a report has two planned, one last-minute and one unclassified teacher-hours
- **THEN** the pie shows planned as two thirds and last-minute as one third, and the table retains all four hours including the unclassified hour

#### Scenario: Shared class demand
- **WHEN** two absent teachers share one class-period
- **THEN** both teacher-periods contribute to absence composition even though demand counts one class-period

### Requirement: Readable absence composition
The absence composition SHALL include category labels, teacher-hours and percentages in a readable legend or accompanying table, without relying on color or hover alone. The table SHALL include Non classificata and identify its percentage denominator; its percentages SHALL use all absent teacher-hours. Zero classified hours SHALL show an explicit empty pie state while retaining any unclassified hours in the table. Display rounding SHALL NOT change underlying totals.

#### Scenario: Empty filtered scope
- **WHEN** the selected scope has no absent teacher-hours
- **THEN** the composition displays an explicit empty state and no percentage slices

#### Scenario: Only unclassified hours
- **WHEN** all absent teacher-hours are unclassified
- **THEN** no pie is drawn and the table shows those hours and their share of all absent teacher-hours
