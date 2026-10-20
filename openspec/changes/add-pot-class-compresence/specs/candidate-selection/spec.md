## MODIFIED Requirements

### Requirement: Effective type precedence
Existing manual availability and automatic class-out release SHALL remain effective as A disposizione. For individually disabled POT associated with the covered class, same-class POT compresence SHALL take precedence over the POT code and disabled status. Class-out release SHALL also take precedence over disabled status for these hours. Otherwise imported activity codes SHALL take precedence over derived teaching types. Sostegno SHALL be distinct from Compresenza ITP; ordinary teaching SHALL use Lezione. Multiple applicable activity codes SHALL use restrictive availability and visibility, and SHALL retain all labels for explanation.

#### Scenario: Class out frees a support teacher
- **WHEN** all classes of a non-absent, unassigned support teacher are out for the hour
- **THEN** the existing automatic availability behavior remains and the candidate uses A disposizione policy

#### Scenario: Explicit GM commitment with a class field
- **WHEN** a timetable hour has GM and a class reference
- **THEN** the GM policy applies rather than silently treating the hour as ordinary teaching or compresenza

#### Scenario: Conflicting activities
- **WHEN** a teacher's hour contains two distinct codes and either code is hidden or unavailable
- **THEN** the candidate is hidden if either is hidden and exceptional if both are visible but either is unavailable

## ADDED Requirements

### Requirement: Same-class POT compresence
A present teacher with an individually disabled POT hour associated with the covered class SHALL be normally selectable as Compresenza - POT, without exceptional confirmation, subject to existing co-teacher campus, room, visibility, absence and double-booking restrictions. Other-class requests SHALL retain disabled POT behavior.

#### Scenario: Cover associated class
- **WHEN** a present eligible teacher has disabled POT associated with the uncovered class at that hour
- **THEN** the candidate is labelled Compresenza - POT and can be assigned normally

#### Scenario: Cover another class
- **WHEN** the requested class differs from the disabled POT association
- **THEN** ordinary disabled POT eligibility and exceptional confirmation rules apply

#### Scenario: Associated class is out
- **WHEN** the associated class is out and the teacher is present and unassigned
- **THEN** the teacher becomes automatically A disposizione with the existing locked-hour cause explanation

#### Scenario: Hard restriction
- **WHEN** the POT teacher is absent or already assigned that hour
- **THEN** same-class POT compresence cannot bypass the restriction
