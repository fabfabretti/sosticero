## ADDED Requirements

### Requirement: Derived prolonged absence entries
An uncovered absent for a prolonged period person SHALL appear automatically in the daily absence sidebar with scheduled hours locked and their prolonged-absence origin explained. Derived hours SHALL combine with existing manual and permit sources into one row, classified as programmed unless a last-minute source takes precedence. Derived periods SHALL identify Amministrazione as their management location; editing SHALL remain restricted to administrators.

#### Scenario: Ianzano needs daily coverage
- **WHEN** a selected date falls within Ianzano's prolonged absence with no active replacement
- **THEN** his scheduled hours appear automatically and produce ordinary class coverage needs
- **AND** no repeated manual daily entry is required

#### Scenario: No scheduled activity
- **WHEN** the absent for a prolonged period person has no scheduled hours on the selected date
- **THEN** the prolonged absence generates no daily row or demand

### Requirement: Covered originals excluded from daily tables
During full-cattedra coverage the original person SHALL be omitted from daily Supplenze absence tables and SHALL generate no demand from that source, including from retained historical personal absence or permit records. The replacement's own absence sources SHALL apply to their inherited schedule. Personal history SHALL remain preserved outside these daily tables.

#### Scenario: Sicoli present
- **WHEN** Gambato is absent for a prolonged period, Sicoli covers her cattedra and Sicoli has no absence
- **THEN** neither Gambato nor Sicoli appears as absent for that coverage
- **AND** Gambato generates no uncovered class rows

#### Scenario: Sicoli absent
- **WHEN** Sicoli is absent during coverage
- **THEN** only Sicoli appears in the daily absence tables for that cattedra
- **AND** coverage needs are generated once from her inherited non-POT schedule

#### Scenario: Manual overlap
- **WHEN** Ianzano has manual and derived absence hours for the same period
- **THEN** one daily row and one set of class coverage needs are produced
- **AND** removing the manual entry leaves derived hours intact
