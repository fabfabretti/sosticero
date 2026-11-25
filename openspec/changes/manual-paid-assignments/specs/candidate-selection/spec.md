# Spec Delta

## ADDED Requirements

### Requirement: Manual assignment payment choice
The candidate drawer SHALL present Assegna manualmente as an identifiable button. Its dialog SHALL offer Gratuita and A pagamento, retain teacher warnings and the optional note, and require an explicit assignment action. New manual assignments SHALL default to Gratuita.

#### Scenario: Choose paid without a declaration
- **WHEN** an operator manually selects an active teacher without a paid availability declaration and chooses A pagamento
- **THEN** the assignment can be saved after the existing warnings are shown
- **AND** the declaration is not created or changed

#### Scenario: Default free assignment
- **WHEN** an operator makes a manual assignment without changing the payment choice
- **THEN** the assignment is gratuita and does not count as paid work

#### Scenario: Existing manual warnings
- **WHEN** the chosen teacher has a scheduling conflict or absence
- **THEN** the existing manual warning is shown before the operator assigns the teacher
- **AND** inactive teachers remain unavailable for manual assignment

### Requirement: Manual paid assignment accounting
A manual paid assignment SHALL be recorded and displayed as a paid substitution, including the optional note, and SHALL use the existing paid accounting, budget, notification, acceptance and refusal behavior. It SHALL NOT consume a permit recovery.

#### Scenario: Register and budget
- **WHEN** a manual paid assignment is saved
- **THEN** Banca ore includes it once in the paid register and count
- **AND** existing pricing, budget totals and warnings apply

#### Scenario: Payment choice changes or assignment is removed
- **WHEN** a manual paid assignment is changed to gratuita, replaced or removed
- **THEN** its paid count and budget contribution are removed
- **AND** changing a free assignment to paid adds one paid contribution

#### Scenario: Reload and resave
- **WHEN** a manual paid assignment is reloaded and saved unchanged
- **THEN** its payment choice, note and paid metadata remain intact without double counting

#### Scenario: Existing assignments
- **WHEN** assignments saved before this change are loaded
- **THEN** existing manual assignments remain free and existing paid assignments retain their paid status
