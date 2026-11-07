## ADDED Requirements

### Requirement: Personal permit ownership across coverage
Permits, manual balances and RP recoveries SHALL belong to stable people independently of cattedra coverage. Coverage changes, renames and returns SHALL NOT transfer debt or change permit IDs, fixed links or deadlines. Historical owners SHALL remain visible in the permit register even when suppressed from daily Supplenze.

#### Scenario: Gambato's debt stays personal
- **WHEN** Sicoli starts covering Gambato's timetable
- **THEN** Gambato retains her existing permit debt in the register
- **AND** Sicoli's balance excludes that debt
- **AND** Sicoli cannot recover Gambato's permits through RP

#### Scenario: Replacement's own permit
- **WHEN** Sicoli takes a permit during coverage
- **THEN** its limits and absence needs use Sicoli's effective non-POT timetable
- **AND** its debt belongs only to Sicoli
