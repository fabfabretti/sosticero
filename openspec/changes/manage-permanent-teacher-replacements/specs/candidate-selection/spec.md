## ADDED Requirements

### Requirement: Effective appointment eligibility
Candidate selection, automatic availability and assignment validation SHALL use the selected date's active person and effective timetable. Covered originals, absent for a prolonged period people and inactive replacements SHALL NOT be offered or newly assigned, including through exceptional or paid assignment paths. Existing saved records SHALL remain identifiable.

#### Scenario: Covered original with debt
- **WHEN** Gambato has outstanding eligible debt but Sicoli covers her cattedra
- **THEN** Gambato is excluded from candidate and availability lists
- **AND** exceptional assignment cannot bypass that exclusion

#### Scenario: Active replacement with own debt
- **WHEN** Sicoli has her own eligible debt and an otherwise qualifying free period
- **THEN** RP selection uses only Sicoli's permits and the existing scheduling and campus restrictions

### Requirement: Excluded POT is not inherited availability
Removed source POT SHALL NOT grant POT availability or preserve a commitment for the replacement. Other independently valid availability sources and RP rules SHALL continue to apply. Other inherited activities SHALL retain their existing eligibility policies.

#### Scenario: Removed POT without another availability source
- **WHEN** Sicoli's source has only POT in a period and she has no other qualifying availability or personal debt
- **THEN** she is not offered as a POT or RP candidate merely because of the removed source activity

#### Scenario: Removed POT with personal RP capacity
- **WHEN** the removed POT leaves Sicoli otherwise free and she has eligible personal debt
- **THEN** ordinary RP eligibility checks apply without treating Gambato's former POT as a commitment
