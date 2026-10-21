## Purpose

Let the office inspect the selected campus's theoretical weekly staffing availability and compare enabled POT-family timetable hours with the expected 40% reference.

## ADDED Requirements

### Requirement: Independent dated weekly view
Stats SHALL show an A disposizione section below Giorno × ora, labelled with the selected Centrale, Succursale or Entrambi scope. A separate date selector SHALL default to today in Europe/Rome, allow future dates and display the containing Monday–Friday week with periods 1–7. Each date SHALL use its effective timetable and Orari overrides. The existing Stats campus selector SHALL control this section too. Historical period filters SHALL NOT change its dates.

#### Scenario: Future week with changed timetable
- **WHEN** the user selects a future date and a timetable or override starts midway through that week
- **THEN** the grid labels actual dates and resolves each weekday using its own effective timetable and overrides

#### Scenario: No recorded absence days
- **WHEN** the historical report contains no recorded absence days
- **THEN** A disposizione remains accessible with its own data and controls

### Requirement: Timetable-only ordinary availability
Disponibili SHALL count distinct active teachers per slot with an enabled availability activity matching the selected campus, including POT, ALF, PE and DI.S, subject to global availability policies. Disabled hours SHALL be excluded. Daily absences, assignments, manual daily availability and released classes SHALL NOT affect counts. Ordinary classroom lessons and exceptional compresenza opportunities SHALL NOT count as freely available.

#### Scenario: Operational changes do not alter capacity
- **WHEN** an enabled POT teacher is absent or already assigned that day
- **THEN** their timetable slot still counts in Disponibili
- **AND** disabling that hour in Orari removes it from Disponibili

#### Scenario: Campus and activity distinctions
- **WHEN** a slot contains enabled Centrale DI.S, a disabled class-associated POT and a Succursale POT
- **THEN** Centrale counts only the DI.S teacher, Succursale counts only the enabled Succursale POT teacher, and Entrambi counts both

### Requirement: Favourable recovery opportunities
Reperibili SHALL count the union of Disponibili and active teachers with date-eligible outstanding Recupero Permesso debt and a favourable free timetable slot for the selected campus. Favourability and campus travel checks SHALL use timetable commitments without daily operational adjustments. Each teacher SHALL count once per cell. Recovery opportunities SHALL be labelled theoretical alternatives rather than additive recoverable hours across the week.

#### Scenario: Recovery opportunity and expiry
- **WHEN** a teacher has remaining eligible recovery debt and a favourable free slot with known compatible campus commitments
- **THEN** they appear in Reperibili under Recupero Permesso
- **AND** they do not appear after the eligible permit window expires

#### Scenario: Absence does not remove a theoretical opportunity
- **WHEN** a teacher with an eligible favourable recovery slot has a daily absence or substitution assignment in that slot
- **THEN** the theoretical slot remains in Reperibili

### Requirement: Accessible teacher breakdown
Disponibili and Reperibili SHALL offer teacher names and activity labels on hover and keyboard focus using the Orari tooltip presentation. Reperibili SHALL distinguish ordinary availability from favourable Recupero Permesso entries. Tooltips SHALL support viewport bounds, scrolling and Escape dismissal; distinctions SHALL NOT rely on colour alone.

#### Scenario: Inspect a mixed cell
- **WHEN** a user hovers or focuses a Reperibili cell containing two ordinary teachers and one recovery teacher
- **THEN** its count is three and the tooltip separately identifies both groups with names

### Requirement: Combined POT-family availability ratio
The selected week SHALL show enabled and total selected-campus teacher-period counts for combined POT, ALF and PE, plus enabled divided by total times 100 and a labelled expected 40% reference. Disabled hours SHALL remain in the denominator. DI.S and RP SHALL be excluded. Each teacher-period SHALL count once, including mixed POT-family labels. Zero total SHALL display an undefined percentage rather than zero percent.

#### Scenario: Combined ratio
- **WHEN** Centrale has 20 POT, 20 ALF and 10 PE hours with 18 enabled hours in total and additional DI.S hours
- **THEN** the summary shows 18 / 50 hours, 36% and the 40% reference
- **AND** DI.S hours, daily absences and assignments do not change that ratio

#### Scenario: No POT-family hours
- **WHEN** the selected week has no selected-campus POT, ALF or PE hours
- **THEN** the summary shows zero total and an unavailable percentage

### Requirement: Clear report boundaries
The section SHALL explain that its figures describe on-paper timetable availability. Historical CSV and print outputs SHALL retain their historical scope; when the new section is printed it SHALL carry the selected campus label, week dates, theoretical method and 40% reference separately.

#### Scenario: Historical report and future capacity
- **WHEN** historical filters cover last month and availability selects next week
- **THEN** the UI and any printed availability section clearly distinguish both date scopes

### Requirement: Combined campus calculations
Entrambi SHALL union campus availability and RP opportunities, counting each teacher once per cell. Its POT-family percentage SHALL divide combined enabled teacher-periods by combined total teacher-periods, not average campus percentages. Unknown-campus activity hours SHALL appear only in Entrambi with their count disclosed. Named-campus RP opportunities SHALL satisfy favourability and travel checks for that campus.

#### Scenario: Weighted combined percentage
- **WHEN** Centrale has 18 enabled hours out of 50 and Succursale has 8 out of 10
- **THEN** their percentages are 36% and 80%, while Entrambi shows 26 / 60 and approximately 43.33%

#### Scenario: Recovery teacher eligible at both campuses
- **WHEN** a teacher has a favourable RP opportunity at both campuses in the same slot
- **THEN** Entrambi counts that teacher once and the tooltip identifies the eligible campuses

#### Scenario: Shared campus control
- **WHEN** the user switches the Stats campus selector from Centrale to Succursale or Entrambi
- **THEN** historical figures, availability cells, teacher tooltips and the POT-family summary all update for that scope
- **AND** the independently selected availability week remains unchanged

#### Scenario: Unknown activity campus
- **WHEN** a scheduled POT-family slot has no resolvable campus
- **THEN** named-campus reports exclude it and Entrambi includes it with unknown-campus disclosure

### Requirement: Responsive weekday widths
All Stats weekday tables SHALL keep every weekday header visible and distribute available width evenly across weekday columns. Narrow screens SHALL shrink columns together instead of leaving Friday disproportionately narrow.

#### Scenario: Narrow weekday table
- **WHEN** the Stats grids are viewed on a narrow screen
- **THEN** all five weekday headers remain visible with equal weekday column widths

### Requirement: Compact nonblocking availability details
Availability hover panels SHALL let pointer input reach underlying cells. Each teacher entry SHALL use a compact name, activity code and C/S campus format, grouped into Disponibili and Reperibili (RP). Clicking or pressing Enter on the cell SHALL pin the panel for scrolling; Escape or moving keyboard focus outside SHALL dismiss it.

#### Scenario: Move between crowded cells
- **WHEN** a large hover panel overlays the neighbouring cell and the pointer moves onto that cell
- **THEN** the neighbouring cell's details replace the previous hover panel

#### Scenario: Inspect a long list
- **WHEN** the user pins a cell's panel by click or Enter
- **THEN** the list can receive pointer input and scroll until dismissed
