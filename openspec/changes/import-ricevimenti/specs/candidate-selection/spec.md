# Candidate Selection Delta

## ADDED Requirements

### Requirement: Reception exclusion from recovery
A reception period SHALL never be offered or accepted as RP, including direct assignment requests. This restriction SHALL apply regardless of campus, manual availability or exceptional confirmation. Existing RP assignments affected by a reception update SHALL retain their permit links and require review.

#### Scenario: Reception with unknown campus
- **WHEN** a teacher with recoverable debt has R in period 4
- **THEN** period 4 cannot consume permit debt through RP even when its location is unknown

#### Scenario: Manual availability does not authorize recovery
- **WHEN** a reception period also has manual availability
- **THEN** a request to assign it as RP is rejected
- **AND** existing non-RP availability policies remain unchanged

### Requirement: Reception-aware travel and uncertainty
Reception commitments SHALL participate in RP campus-transfer checks on both sides of a proposed period. Unknown reception locations SHALL prevent confirmed convenience but SHALL NOT alone hard-block an otherwise eligible RP assignment. Potential reception adjacency SHALL be labelled Potenzialmente favorevole · sede da verificare and remain outside the confirmed favorable group.

#### Scenario: Unknown reception adjacent to a free hour
- **WHEN** a free hour is immediately adjacent to R with unknown campus and no known travel conflict exists
- **THEN** RP remains selectable with the uncertainty label in the non-confirmed group

#### Scenario: Known reception blocks transfer
- **WHEN** an RP period in succursale directly precedes a reception in centrale without an intervening intervallo
- **THEN** the RP assignment is rejected for infeasible campus transfer

## MODIFIED Requirements

### Requirement: Convenient RP periods
An RP period SHALL be convenient if immediately before or after a teaching or reception period, or inside a gap between teaching periods that day, and campus transfers are feasible on both sides. Intervalli SHALL be the boundaries 2–3 and 4–5. A transfer between different known campuses SHALL require an intervening intervallo. Missing campus information SHALL NOT establish convenience. Reception adjacency alone SHALL NOT make a multi-period gap favorable.

#### Scenario: Same-campus teaching pattern
- **WHEN** a teacher teaches periods 2, 3 and 5 in centrale
- **THEN** free periods 1, 4 and 6 are convenient RP periods for centrale
- **AND** free period 7 is a non-convenient RP period

#### Scenario: Gap spanning multiple periods
- **WHEN** a teacher teaches periods 2 and 6 in centrale
- **THEN** otherwise free periods 3, 4 and 5 are convenient for centrale

#### Scenario: Adjacent cross-campus period with break
- **WHEN** a teacher teaches period 3 in centrale and is requested for period 2 in succursale with no preceding conflict
- **THEN** the 2–3 intervallo permits the transfer and the RP period is convenient

#### Scenario: Adjacent transfer without break
- **WHEN** a teacher teaches period 2 in centrale and is requested for period 1 in succursale
- **THEN** the transfer lacks an intervallo and the RP assignment is blocked

#### Scenario: Both sides of gap matter
- **WHEN** a teacher teaches periods 3 and 5 in centrale and is requested for period 4 in succursale
- **THEN** the 4–5 intervallo does not compensate for the missing 3–4 intervallo
- **AND** the RP assignment is blocked

#### Scenario: No teaching that day
- **WHEN** a teacher has eligible debt but no teaching or reception periods that day
- **THEN** otherwise eligible RP hours appear at the bottom

#### Scenario: Confirmed reception adjacency
- **WHEN** a teacher has R in period 4 in centrale and otherwise free periods 3 and 5 with no conflicting commitment
- **THEN** periods 3 and 5 are favorable RP opportunities in centrale
- **AND** period 4 remains excluded from RP
