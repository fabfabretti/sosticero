# Spec Delta

## ADDED Requirements

### Requirement: Disabled special hours require exceptional assignment
A disabled special hour in the effective timetable SHALL remain a commitment and SHALL be offered only under Solo in caso di necessità when all applicable types are visible. Assignment SHALL require the existing explicit exceptional confirmation. Hidden types, absence, retirement, double booking and applicable campus restrictions SHALL remain non-overridable. Disabling SHALL not make the hour free for RP.

#### Scenario: Disabled available POT
- **WHEN** POT is globally available and visible but disabled for the teacher and substitution date
- **THEN** that teacher appears only in the exceptional group with the activity label and disabled reason
- **AND** direct assignment without exceptional confirmation is rejected

#### Scenario: Disabled hidden commitment
- **WHEN** a disabled activity has any hidden type
- **THEN** its teacher is omitted for that commitment and cannot be newly assigned even with exceptional confirmation

#### Scenario: Explicit availability cannot bypass disable
- **WHEN** manual availability also exists during a disabled special hour
- **THEN** the teacher still requires exceptional assignment and the disabled activity's visibility restrictions apply

#### Scenario: Date outside override
- **WHEN** the requested date is before the override starts or after it ends with no other applicable override
- **THEN** normal imported activity policy applies

#### Scenario: Disabled commitment is not RP capacity
- **WHEN** a teacher has permit debt and a disabled activity in the requested hour
- **THEN** disabling does not make that hour eligible for RP

### Requirement: Effective special-hour positions govern candidates
Candidate availability, activity labels and campus feasibility SHALL follow moved or swapped special hours for the requested date. Unrelated candidate ordering and existing profile information SHALL remain unchanged.

#### Scenario: POT moves to another day
- **WHEN** a dated override moves POT from Monday hour 2 to an empty Tuesday hour 3
- **THEN** POT availability exists on Tuesday hour 3 and no longer on Monday hour 2 within the effective interval
- **AND** the moved hour retains its campus for eligibility checks
