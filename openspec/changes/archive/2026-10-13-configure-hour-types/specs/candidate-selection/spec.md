# Candidate Selection Delta

## ADDED Requirements

### Requirement: Candidate type policy
Candidate selection SHALL apply the effective hour type's availability and visibility policies. Hidden types SHALL not be offered or newly assigned. Available visible types SHALL be normally selectable. Visible unavailable types SHALL appear after normal candidates under Solo in caso di necessità, labelled Occupato and with their type badge. Existing profile information SHALL remain visible.

#### Scenario: Potenziamento becomes available
- **WHEN** PE is configured available and visible
- **THEN** eligible teachers with PE at the requested hour are offered as normal candidates

#### Scenario: Hidden compresenza
- **WHEN** Compresenza ITP visibility is turned off
- **THEN** teachers whose effective type is Compresenza ITP are omitted from candidate selection
- **AND** direct new-assignment requests for those hidden candidates are rejected

#### Scenario: Separate fallback types
- **WHEN** Compresenza ITP and Sostegno are visible and unavailable
- **THEN** eligible teachers of each type appear in the exceptional group with distinct badges and their existing teacher profiles

### Requirement: Explicit exceptional assignment
Assigning a visible unavailable candidate SHALL require an explicit exceptional action and confirmation naming the teacher, hour and occupied type. The server SHALL reject the assignment without that confirmation. Absence, double booking, retired teachers and hidden types SHALL remain non-overridable restrictions.

#### Scenario: Confirmed compresenza exception
- **WHEN** the office selects Usa comunque for a visible occupied compresenza candidate and confirms
- **THEN** the assignment is accepted if no hard restriction applies and records that it was exceptional

#### Scenario: Cancel exceptional action
- **WHEN** the office cancels exceptional-assignment confirmation
- **THEN** no assignment changes

#### Scenario: Direct assignment without confirmation
- **WHEN** an API request assigns an occupied candidate without explicit exceptional confirmation
- **THEN** the server rejects it

#### Scenario: Hard restriction wins
- **WHEN** an absent or already assigned teacher is requested with exceptional confirmation
- **THEN** the server rejects it with the existing restriction reason

### Requirement: Policy changes preserve historical assignments
Changing type rules SHALL affect subsequent candidate selection and assignment validation without deleting or rewriting existing assignments. A previously assigned teacher SHALL remain identifiable even if their type becomes hidden or unavailable.

#### Scenario: Hide an assigned type
- **WHEN** the office hides a type with existing assignments
- **THEN** those assignments remain displayed and stored while that type is excluded from new choices

### Requirement: Effective type precedence
Existing manual availability and automatic class-out release SHALL remain effective as A disposizione. Otherwise imported activity codes SHALL take precedence over derived teaching types. Sostegno SHALL be distinct from Compresenza ITP; ordinary teaching SHALL use Lezione. Multiple applicable activity codes SHALL use restrictive availability and visibility, and SHALL retain all labels for explanation.

#### Scenario: Class out frees a support teacher
- **WHEN** all classes of a non-absent, unassigned support teacher are out for the hour
- **THEN** the existing automatic availability behavior remains and the candidate uses A disposizione policy

#### Scenario: Explicit GM commitment with a class field
- **WHEN** a timetable hour has GM and a class reference
- **THEN** the GM policy applies rather than silently treating the hour as ordinary teaching or compresenza

#### Scenario: Conflicting activities
- **WHEN** a teacher's hour contains two distinct codes and either code is hidden or unavailable
- **THEN** the candidate is hidden if either is hidden and exceptional if both are visible but either is unavailable

### Requirement: Normal candidate ordering and manual options
Normally available candidates SHALL retain existing category and campus ordering where applicable. Newly supported activity types SHALL use the potenziamento tier. Exceptional occupied candidates SHALL follow normally available choices. Dirigente and entry/exit options SHALL retain their existing behavior and SHALL not be treated as imported hour types.

#### Scenario: Newly supported activity ranking
- **WHEN** RIT becomes available and visible
- **THEN** its candidates use the potenziamento tier with existing campus, load and name tie breakers

#### Scenario: Entry and exit unaffected
- **WHEN** type settings change
- **THEN** entry and exit options retain their existing effective-boundary visibility and validation
