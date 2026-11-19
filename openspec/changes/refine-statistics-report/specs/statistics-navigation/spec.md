## MODIFIED Requirements

### Requirement: Complete reports across tabs
Print preview and printing SHALL include all report sections regardless of active tab, with historical filters, units and quality notes and the independently dated availability section. Long tables SHALL be limited as specified for compact tables. Historical CSV SHALL retain complete existing sections and absence-type and teacher breakdowns with units and scope. Tab selection SHALL NOT limit exported data.

#### Scenario: Print from a different tab
- **WHEN** the user prints while Classi e docenti is active
- **THEN** the report includes summary, historical charts and breakdowns, and availability with its own week label

## ADDED Requirements

### Requirement: Compact statistics tables
Statistics tables with more than 10 rows SHALL initially show their first 10 in their existing order and offer a control to show all on screen. Print preview and print SHALL always show the first 10 regardless of expansion, with an indication when rows are omitted. CSV SHALL retain all rows.

#### Scenario: Expanded table is printed
- **WHEN** a 30-row table has been expanded on screen and the report is printed
- **THEN** the printed table contains the first 10 rows and indicates that 20 rows are omitted, while CSV retains all 30

### Requirement: Coverage composition
Andamento SHALL present a pie and readable table of valid covered hours by recorded coverage type, including existing categories such as C, POT, RP and payment when present. Percentages SHALL use valid covered hours as their denominator. Pending, uncovered, entry and exit outcomes SHALL be excluded. Exceptional coverage SHALL NOT be counted twice.

#### Scenario: Mixed outcomes
- **WHEN** a report has two valid C coverages, one valid paid coverage, and one pending hour
- **THEN** the pie shows C as two thirds and payment as one third and excludes the pending hour

#### Scenario: No valid coverage
- **WHEN** no valid covered hours exist
- **THEN** an explicit empty state replaces the coverage pie

### Requirement: Future custom periods
The calendar SHALL allow selecting future dates in a custom period. Reports for such periods SHALL include available recorded facts within the selected range without projecting missing facts. Preset periods SHALL continue to end today. A report whose selected range extends beyond today in Rome SHALL visibly warn on screen, in preview and in print that future figures are estimates and can change.

#### Scenario: Range includes future days
- **WHEN** a user selects a custom range extending into the future
- **THEN** available recorded facts in that range contribute to the report and an estimate warning is visible even if no future records exist

#### Scenario: Default period
- **WHEN** a user chooses a preset period
- **THEN** it ends today and does not include future facts

### Requirement: Concise report copy
Statistics and printed reports SHALL use concise, clear Italian labels and explanations, avoiding repeated methodology while retaining essential units, denominators and applicable data-quality warnings.

#### Scenario: Read the printed report
- **WHEN** a report is printed
- **THEN** its figures remain interpretable from their labels and necessary notes without repeated explanatory paragraphs
