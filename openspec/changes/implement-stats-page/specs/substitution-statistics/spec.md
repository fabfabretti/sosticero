## Purpose

Provide reproducible evidence of staff absences, substitution demand and outcomes across campuses and reporting periods, preserving recorded historical context.

## ADDED Requirements

### Requirement: Dated heatmap breakdown
Each populated heatmap cell SHALL show its dated observations on hover and keyboard focus, using the active campus, reporting period and measure. The breakdown SHALL include zero values on included dates and exclude unrecorded dates. Tooltips SHALL remain within the viewport, support scrolling for long lists and dismiss with Escape.

#### Scenario: Verify a Monday average
- **WHEN** the included Mondays have values zero and three for the selected period
- **THEN** the cell shows 1.5 and its tooltip lists both dates with their respective zero and three values

### Requirement: Compact average-first reporting interface
Stats SHALL lead with compact daily averages and subordinate period totals. Campus and period presets SHALL use the Supplenze segmented-button style. A visible calendar SHALL highlight preset ranges and allow inclusive custom range selection across months. The daily chart SHALL show three lines; weekday and period averages SHALL use single-series bars for class-period demand. The heatmap SHALL use weekday columns and period rows. Charts SHALL have legends without a metric dropdown.

#### Scenario: Select a custom range
- **WHEN** the user selects two dates on the calendar, in either order or across months
- **THEN** the ordered inclusive range is highlighted and applied to the report

#### Scenario: Compare workload measures
- **WHEN** a nonempty report is displayed
- **THEN** daily averages are the prominent summary figures and the daily chart shows all three workload measures, with three lines for daily trends and only class-period demand in weekday and period bars

### Requirement: Durable dated facts
The system SHALL retain dated absence facts and class-period demand facts, including campus, absent teacher identities and outcome. Pending demand and absences without substitution rows SHALL be retained. Timetable replacement alone SHALL NOT rewrite existing facts. Explicit operational corrections SHALL update affected facts atomically.

#### Scenario: Timetable replacement
- **WHEN** a new timetable changes a class campus or removes a teacher's lesson
- **THEN** previously saved statistics retain their campus, absence and demand facts

#### Scenario: Correct an absence
- **WHEN** an absence or permit is corrected or deleted
- **THEN** affected saved facts reflect the correction without changing unrelated dates or losing historical context for unchanged facts

### Requirement: Legacy reconstruction and portability
Existing records without facts SHALL be reconstructed once from available records and the current timetable, marked as reconstructed. Unresolvable context and orphan assignments SHALL be disclosed. Facts SHALL survive backups and validated archive round trips. Malformed archives SHALL fail atomically; legacy archives SHALL remain accepted.

#### Scenario: Reconstruct once
- **WHEN** legacy records are first migrated and a timetable is later replaced
- **THEN** reconstructed facts retain their original reconstruction and the dashboard discloses their provenance

#### Scenario: Import rollback
- **WHEN** an archive contains invalid statistical facts or outcomes
- **THEN** no operational records or saved facts are replaced

### Requirement: Campus and period filters
Stats SHALL filter all views by Centrale, Succursale or Totale and All, This week, This month or Custom inclusive dates. Week starts Monday; presets end today in Europe/Rome. All begins at the earliest recorded absence. Invalid custom ranges SHALL show an error. Unknown-campus facts SHALL be included in Totale and disclosed separately.

#### Scenario: Filter unknown campus
- **WHEN** a period includes facts with unknown campus
- **THEN** Totale includes them, named-campus views exclude them, and the unknown-campus amount is visible

### Requirement: Recorded-day averages
Averages SHALL use dates with at least one recorded manual or permit absence within the selected period, excluding blank and future dates. Campus views SHALL use the same date set. Weekday averages SHALL use included occurrences of that weekday; period averages SHALL include zeroes within recorded days. The date count and denominator definition SHALL be visible.

#### Scenario: Zero at one campus
- **WHEN** two Mondays have recorded absences and only one has Centrale absences
- **THEN** Centrale's Monday average divides its Monday total by two

#### Scenario: Empty period
- **WHEN** no recorded absence dates match the period
- **THEN** the screen shows an empty state and no undefined or misleading averages

### Requirement: Distinct workload units
Stats SHALL distinguish unique absent teachers per date, absent teacher-periods and class-period demand, leading with demand. Manual/permit overlaps SHALL count once. Co-absent teachers SHALL count separately as staff absence but once per class-period demand. Units labelled hours SHALL explicitly mean timetable periods. Cross-campus teacher totals SHALL deduplicate identities.

#### Scenario: Co-absence
- **WHEN** two teachers are absent in the same period for one class
- **THEN** statistics count two absent teachers, two teacher-periods and one class-period demand

### Requirement: Separate outcomes
Every class-period demand SHALL have exactly one reporting outcome: covered, uncovered, late entry, early exit or pending. Coverage percentage SHALL divide covered periods by total demand. Uncovered SHALL require an explicit selection; missing assignments SHALL remain pending. Entry/exit periods SHALL remain in demand even when absent from the live substitution table. Invalid or orphan assignments SHALL be disclosed and SHALL NOT silently inflate valid coverage.

#### Scenario: Outcome reconciliation
- **WHEN** one period is covered, one uncovered, one late entry, one early exit and one pending
- **THEN** demand is five, coverage is 20 percent and each outcome has its own count

### Requirement: Dashboard and shareable reports
Stats SHALL show summary totals and daily averages, daily trends, weekday averages, period averages, a weekday-by-period heatmap, coverage by assignment type, exceptional cover, worst days and affected-class summaries. CSV and print views SHALL preserve selected filters, units, denominators and provenance. Charts SHALL offer readable values beyond color and support both themes and narrow screens.

#### Scenario: Share a filtered report
- **WHEN** a Succursale custom period is exported or printed
- **THEN** its report contains matching values, dates, campus, recorded-day count and reconstruction caveats
