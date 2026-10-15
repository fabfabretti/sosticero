# Spec Delta

## MODIFIED Requirements

### Requirement: Persistent application bar
Every screen SHALL render a top bar containing the Sosticero brand with a
glasses icon and the navigation tabs. The bar SHALL stay visible while the
screen's content scrolls.

#### Scenario: Bar present on every screen
- **WHEN** any tab is open
- **THEN** the top bar shows the Sosticero brand, the glasses icon, and all six tabs

#### Scenario: Bar stays visible while scrolling
- **WHEN** the open screen's content is scrolled
- **THEN** the top bar remains visible

### Requirement: Tab navigation
The bar SHALL offer six tabs — Supplenze, Permessi, Orari, Banca ore, Stats and
Settings — and selecting a tab SHALL show that tab's screen and mark it as the
current tab. Exactly one tab SHALL be current at a time.

#### Scenario: Selecting a tab opens its screen
- **WHEN** the user selects "Banca ore"
- **THEN** the Banca ore screen is shown and its tab is marked current

#### Scenario: Orari opens the teacher timetables
- **WHEN** the user selects "Orari"
- **THEN** the teacher timetable screen is shown and its tab is marked current

#### Scenario: Only one tab is current
- **WHEN** any tab is current
- **THEN** no other tab is marked current

#### Scenario: Supplenze is home
- **WHEN** the app is first opened with no tab specified
- **THEN** the Supplenze screen is shown and its tab is marked current
