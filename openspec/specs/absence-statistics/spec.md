# absence-statistics Specification

## Purpose

Explain the composition of recorded teacher absences and their distribution across teachers using consistent timetable-hour units and historical reporting scopes.

## Requirements

### Requirement: Absence type composition
Andamento SHALL show a pie chart for Programmata, Last minute, In gita, In sciopero and Non classificata, weighted by absent teacher-hours in the historical campus and period scope. Each unique absent teacher-period SHALL contribute once. Percentages SHALL divide category hours by total absent teacher-hours. Missing classifications SHALL remain Non classificata without timing-based inference.

#### Scenario: Classified and unclassified hours
- **WHEN** a report has two planned, one last-minute and one unclassified teacher-hours
- **THEN** the breakdown shows 50%, 25% and 25%, respectively, with four total hours

#### Scenario: Shared class demand
- **WHEN** two absent teachers share one class-period
- **THEN** both teacher-periods contribute to absence composition even though demand counts one class-period

### Requirement: Readable absence composition
The absence composition SHALL include category labels, teacher-hours and percentages in a readable legend or accompanying values, without relying on color or hover alone. Zero total teacher-hours SHALL show an empty state rather than a misleading pie or undefined percentages. Display rounding SHALL NOT change underlying totals.

#### Scenario: Empty filtered scope
- **WHEN** the selected scope has no absent teacher-hours
- **THEN** the composition displays an explicit empty state and no percentage slices

### Requirement: Teacher absence totals
Classi e docenti SHALL show Assenze per docente with teacher name, absent timetable hours and distinct days with absence in the active historical campus and period. Rows SHALL sort by descending hours, with deterministic ties. Hours SHALL match the summary teacher-hour total, and duplicate manual/permit absence slots SHALL count once.

#### Scenario: Teacher across campuses
- **WHEN** a teacher is absent for two Centrale periods and one Succursale period on one date
- **THEN** Totale shows three hours and one day, Centrale two hours and one day, and Succursale one hour and one day

#### Scenario: Overlapping absence and permit
- **WHEN** a manual absence and permit overlap for one teacher-period
- **THEN** the teacher table and composition count that period once and their hour totals reconcile with the summary

### Requirement: Recorded classifications and historical context
Breakdowns SHALL use stored absence and permit classifications and recorded historical absence slots. Missing legacy classifications SHALL remain unclassified. Classification corrections SHALL update affected breakdowns without changing historical campus/hour context or unrelated records. Conflicting overlapping classifications SHALL use a deterministic, documented rule.

#### Scenario: Correct a classification
- **WHEN** an existing absence classification changes from Programmata to Last minute
- **THEN** its teacher-hours move between those categories while teacher totals and captured campus context remain unchanged
