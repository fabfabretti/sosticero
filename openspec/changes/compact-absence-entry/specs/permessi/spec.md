# Permessi Delta

## ADDED Requirements

### Requirement: Optional permit classification
The compact Permessi entry and edit form SHALL provide mutually exclusive Programmata and Last minute toggle buttons, allowing neither. Pressing the active button SHALL clear the choice. New forms SHALL initially be unspecified; after creating a permit the choice SHALL remain set for subsequent entries during the mounted page session. Editing SHALL load the saved choice. Classification SHALL NOT alter permit limits, recovery identity or accounting.

#### Scenario: Record and edit classification
- **WHEN** a programmed permit is saved and reopened for editing
- **THEN** Programmata is selected
- **AND** the user can switch to Last minute or clear the choice

#### Scenario: Repeated entry
- **WHEN** a permit with Last minute selected is successfully created
- **THEN** Last minute stays selected for the next new permit

### Requirement: Portable permit classification
Permit classification SHALL survive reload, database backup, archive import/export and valid permit moves to another date or teacher. Missing metadata SHALL mean unspecified without inference from request dates. Deletion SHALL remove associated classification. Invalid values or classification referencing a missing permit SHALL reject changes atomically. Updates omitting classification SHALL preserve it; explicit clearing SHALL remove it.

#### Scenario: Legacy data
- **WHEN** existing permit data without classification is loaded or imported
- **THEN** it remains valid and unspecified

#### Scenario: Move and round trip
- **WHEN** a classified permit is validly moved to another date and exported then imported
- **THEN** classification follows that permit and no metadata remains at its previous location

#### Scenario: Malformed import
- **WHEN** an archive has an invalid permit classification or classification without a permit
- **THEN** the complete import fails without modifying existing records

### Requirement: Classified permits participate in sidebar grouping
Permit-derived teacher absences SHALL participate in the same daily sidebar grouping as manual absences. Any Last minute source SHALL take precedence over Programmata and unspecified, and Programmata SHALL take precedence over unspecified. The teacher SHALL appear only once with the union of absent hours, retaining locked permit hours and their explanations.

#### Scenario: Last-minute permit takes precedence
- **WHEN** a teacher has a last-minute permit and a programmed manual absence that day
- **THEN** the teacher appears once under Assenze last minute with the combined absent hours

#### Scenario: Permit-only absence
- **WHEN** a programmed permit is the teacher's only absence source
- **THEN** the teacher appears under Assenze programmate with its permit hours locked
