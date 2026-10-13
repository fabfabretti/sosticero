# Hour Types Delta

## Purpose

Let the office configure the meaning and substitution policy of timetable activity types consistently across all teachers and dates.

## ADDED Requirements

### Requirement: Complete type inventory
The system SHALL preserve imported activity codes and list each distinct normalized code in Settings alongside Lezione, Compresenza ITP and Sostegno. It SHALL retain original labels and distinguish derived types from imported codes. Equivalent punctuation/case variants of known codes SHALL share one policy.

#### Scenario: Import previously unsupported codes
- **WHEN** a timetable contains GM, PE, RIT, CPO, UTC and U.T.C
- **THEN** Settings lists GM, PE, RIT, CPO and a single UTC entry without discarding the original activity labels

#### Scenario: Timetable teaching types
- **WHEN** the office opens Settings
- **THEN** Lezione, Compresenza ITP and Sostegno have separately configurable rows

### Requirement: Independent global type controls
Each type SHALL expose independent boolean settings labelled Disponibile per supplenze, Mostra tra i candidati, and Presso questa scuola. Changes SHALL apply to all occurrences of that type across teachers and dates. School membership SHALL be metadata independent of availability, visibility and campus.

#### Scenario: Other-school commitment
- **WHEN** GM has all three controls off
- **THEN** its teachers are hidden from candidate selection during GM hours and GM is recorded as outside this school

#### Scenario: Flexible potenziamento
- **WHEN** the office changes PE availability while leaving visibility and school membership on
- **THEN** every PE occurrence uses the new availability without changing its visibility or school membership

#### Scenario: Visibility independent of availability
- **WHEN** a type is available but its visibility is off
- **THEN** its teachers do not appear in candidate selection for that type

### Requirement: Conservative initial policies
GM SHALL initially be unavailable, hidden and outside this school. Lezione SHALL initially be unavailable, hidden and at this school. Compresenza ITP and Sostegno SHALL initially be unavailable, visible and at this school. Existing POT, UTC, UTS and DIS eligibility SHALL be preserved initially. Other newly discovered codes SHALL initially be unavailable and hidden, with school membership unset until chosen by the office.

#### Scenario: Unknown activity semantics
- **WHEN** PE, RIT or another unfamiliar code is first discovered
- **THEN** it is unavailable and hidden until configured and Settings indicates that its school membership needs review

### Requirement: Stable type colors and consistent presentation
Each type SHALL receive a randomly chosen readable color once and retain it across reloads, imports and restarts. Settings and candidate badges SHALL use the same color. The Settings table SHALL follow existing typography, spacing, surfaces and themes, with labelled keyboard-operable controls and text labels independent of color.

#### Scenario: Repeated type display
- **WHEN** the same type appears in Settings and a candidate badge after a restart
- **THEN** both use its previously saved color with readable text in light and dark themes

### Requirement: Persistent and portable policies
Type settings and colors SHALL persist across timetable replacement, application restarts, JSON export/import and database backup/restore. Legacy JSON archives without settings SHALL remain importable and preserve current settings. Invalid settings SHALL cause an import or update to fail without partial writes.

#### Scenario: Timetable replacement
- **WHEN** a new timetable contains previously configured codes and a new code
- **THEN** existing policies and colors remain and only the new code receives initial settings

#### Scenario: Archive round trip
- **WHEN** an archive containing type settings is exported and imported into a compatible dataset
- **THEN** its policies and colors are restored with its operational state

#### Scenario: Legacy archive import
- **WHEN** a valid legacy archive without type settings is imported
- **THEN** operational state is restored and current type settings remain unchanged

#### Scenario: Invalid policy data
- **WHEN** an update or archive contains invalid control values or color data
- **THEN** the operation fails and stored settings and state remain unchanged
