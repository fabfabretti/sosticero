## Purpose

Provide compact, persistent navigation through historical statistics and weekly availability while keeping summary metrics understandable and reports complete.

## ADDED Requirements

### Requirement: Persistent statistics tabs
Statistiche SHALL show summary cards and the five outcome counts above tabs named Andamento, A disposizione and Classi e docenti. It SHALL remember the active tab across visits in the same browser, defaulting to Andamento when no valid preference exists. Tabs SHALL support keyboard navigation and expose selected state accessibly.

#### Scenario: Return to statistics
- **WHEN** the user selects Classi e docenti, leaves and returns
- **THEN** Classi e docenti is selected and summary cards and outcomes remain above it

#### Scenario: Unavailable browser storage
- **WHEN** stored preference is invalid or browser storage is unavailable
- **THEN** the page opens on Andamento and tabs remain usable

### Requirement: Grouped analysis views
Andamento SHALL contain daily trends, weekday and hourly averages, Giorno × ora, coverage methods, highest-demand days and absence-type composition. A disposizione SHALL contain weekly availability. Classi e docenti SHALL contain class demand and teacher absence totals. Existing chart value disclosures SHALL remain available.

#### Scenario: Browse historical analyses
- **WHEN** the user opens Andamento
- **THEN** historical analyses appear together without weekly availability or class and teacher tables interrupting them

### Requirement: Contextual metric explanations
Each summary metric title SHALL have an (i) control explaining its own unit and counting rules, replacing the explanatory paragraphs below the cards. Help SHALL support hover, focus and click/tap, stay within the viewport and dismiss with Escape. Longer methodology SHALL remain in a collapsed disclosure; applicable data-quality warnings SHALL remain visible.

#### Scenario: Understand different hour totals
- **WHEN** the user opens help for Ore docenti assenti or Ore da coprire
- **THEN** the explanation distinguishes teacher-periods from deduplicated class-period demand, including absences without class cover

#### Scenario: Read help on a touch device
- **WHEN** the user taps an (i) control
- **THEN** its explanation remains readable until dismissed without requiring hover

### Requirement: Independent availability week
A disposizione SHALL retain its own week selector, shared campus filter, dated timetable resolution and selected-week POT calculations. Historical period changes SHALL NOT change its selected week. Switching tabs SHALL preserve current historical filters and the availability week. Availability SHALL remain accessible when no historical absence days exist.

#### Scenario: Historical month and future availability
- **WHEN** the historical period is last month and availability selects a future week, then the user changes tabs
- **THEN** both selections remain intact and POT totals refer to the selected availability week

### Requirement: Complete reports across tabs
Print preview and printing SHALL include all report sections regardless of active tab, with historical filters, units and quality notes and the independently dated availability section. Historical CSV SHALL retain existing sections and append absence-type and teacher breakdowns with units and scope. Tab selection SHALL NOT limit exported data.

#### Scenario: Print from a different tab
- **WHEN** the user prints while Classi e docenti is active
- **THEN** the report includes summary, historical charts and breakdowns, and availability with its own week label
