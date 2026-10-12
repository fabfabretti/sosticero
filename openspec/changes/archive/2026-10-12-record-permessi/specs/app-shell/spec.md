# Spec Delta

## MODIFIED Requirements

### Requirement: Placeholder screens for future features
Banca ore, Stats and Settings SHALL each render a placeholder screen that identifies itself. Permessi SHALL render the permit register. This change SHALL NOT implement Banca ore, Stats or Settings features.

#### Scenario: Each future tab shows a placeholder
- **WHEN** the user opens Banca ore, Stats or Settings
- **THEN** a placeholder screen for that tab is shown

#### Scenario: Supplenze is not a placeholder
- **WHEN** the user opens Supplenze
- **THEN** the substitution screen is shown, including permit-derived absences

#### Scenario: Permessi is functional
- **WHEN** the user opens Permessi directly or through navigation
- **THEN** the permit register is shown instead of the placeholder
