## ADDED Requirements

### Requirement: Conditional rows for class-associated POT absence
An absent teacher's disabled POT hour associated with a class SHALL generate a substitution row only when no other teacher remains scheduled and present in that class and hour. Where another absence already creates that row, existing merging and canonical identity rules SHALL apply, with one substitution for the class and period.

#### Scenario: Another teacher remains
- **WHEN** a class-associated POT teacher is absent and another teacher remains present in that class and hour
- **THEN** the POT absence generates no substitution row

#### Scenario: POT teacher alone is absent
- **WHEN** the absent class-associated POT teacher is the only teacher scheduled in that class and hour
- **THEN** the class receives one substitution row

#### Scenario: All co-teachers absent
- **WHEN** the class-associated POT teacher and all other teachers in that class and hour are absent
- **THEN** one merged substitution row includes the absent teachers under existing canonical identity rules

#### Scenario: POT without class
- **WHEN** a disabled POT hour has no associated class and its teacher is absent
- **THEN** no class substitution row is generated from that POT hour
