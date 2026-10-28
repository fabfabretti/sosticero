# Spec Delta

## ADDED Requirements

### Requirement: Empty-hour availability consultation
For each hour with no substitution rows in the selected campus view, Supplenze SHALL retain the empty-hour message and offer a keyboard-accessible “Consulta disponibilità” action. It SHALL open consultation for the selected date and hour without requiring an absence or substitution.

#### Scenario: Entire day has no substitutions
- **WHEN** the selected day has no substitutions
- **THEN** each of the seven hour sections offers consultation

#### Scenario: Only the other campus has a substitution
- **WHEN** Centrale is selected and an hour has substitutions only in Succursale
- **THEN** that hour offers consultation for Centrale

#### Scenario: Visible substitution exists
- **WHEN** an hour contains a substitution in the selected view
- **THEN** its existing substitution rows and candidate selection remain unchanged
- **AND** no empty-hour consultation row is added for that hour

### Requirement: Consultation follows the campus view
Consultation SHALL open directly for Centrale or Succursale when that tab is selected. Entrambe SHALL show both campuses with clear campus labels. Unresolved campus availability SHALL be labelled “Sede non indicata” in Entrambe and SHALL NOT be represented as belonging to a known campus.

#### Scenario: Centrale selected
- **WHEN** consultation opens from the Centrale tab
- **THEN** only availability for Centrale is shown without a further campus-selection step

#### Scenario: Succursale selected
- **WHEN** consultation opens from the Succursale tab
- **THEN** only availability for Succursale is shown without a further campus-selection step

#### Scenario: Both campuses selected
- **WHEN** consultation opens from Entrambe
- **THEN** availability for both campuses is shown with campus labels
- **AND** any unresolved campus is explicitly identified

### Requirement: Consultation shows current available teachers
Consultation SHALL show teacher names, availability types and campus for the selected day and hour using effective timetables, manual availability, class-out releases, type policies and RP eligibility. Absent, retired, already assigned, hidden-type and occupied exceptional candidates SHALL be excluded. Class-specific suitability SHALL NOT be claimed without a target class.

#### Scenario: Existing restrictions apply
- **WHEN** a teacher is absent or already assigned in the consulted hour
- **THEN** that teacher is not listed as available

#### Scenario: Types and recovery
- **WHEN** a teacher has visible available POT, manual availability, automatic release or eligible RP
- **THEN** they appear with the applicable availability type subject to existing restrictions
- **AND** RP transfer checks use the consulted campus

#### Scenario: No available teachers
- **WHEN** no teacher qualifies for the selected hour and campus
- **THEN** consultation shows an explicit empty state

### Requirement: Consultation cannot assign or change data
Consultation SHALL be read-only, with no assignment, exceptional override, entry, exit, Dirigente or Scoperta actions. Opening or closing it SHALL NOT create rows, assignments or recovery links, change counts or affect exports. Existing authenticated read access SHALL apply; invalid date, hour or campus inputs SHALL be rejected.

#### Scenario: Inspect and close
- **WHEN** a user opens consultation and closes it using the close control or Escape
- **THEN** no stored data, assignment counts or export content changes
- **AND** no assignment control was offered

#### Scenario: Read-only account
- **WHEN** an authenticated user without assignment rights opens consultation
- **THEN** they can inspect availability without gaining write access

#### Scenario: Invalid request
- **WHEN** consultation is requested with an invalid date, hour or campus
- **THEN** the server rejects the request without changing data
