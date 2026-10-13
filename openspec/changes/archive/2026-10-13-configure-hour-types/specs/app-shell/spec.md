# App Shell Delta

## MODIFIED Requirements

### Requirement: Placeholder screens for future features
Banca ore and Stats SHALL each render a placeholder screen that identifies itself. Permessi SHALL render the permit register. Settings SHALL render functional data management, backups and hour-type configuration. This change SHALL NOT implement Banca ore or Stats features.

#### Scenario: Each future tab shows a placeholder
- **WHEN** the user opens Banca ore or Stats
- **THEN** a placeholder screen for that tab is shown

#### Scenario: Supplenze is not a placeholder
- **WHEN** the user opens Supplenze
- **THEN** the substitution screen is shown, including permit-derived absences

#### Scenario: Permessi is functional
- **WHEN** the user opens Permessi directly or through navigation
- **THEN** the permit register is shown instead of the placeholder

#### Scenario: Settings is functional
- **WHEN** the user opens Settings
- **THEN** existing data management and backup controls remain available alongside the Tipi di ora table
- **AND** the existing Settings credits footer remains at the bottom
