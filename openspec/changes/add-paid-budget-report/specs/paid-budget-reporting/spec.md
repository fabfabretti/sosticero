# Spec Delta

## Purpose

Enable staff to preview and print paid substitution budget usage and the related assignment register for selected sedi.

## ADDED Requirements

### Requirement: Select and preview the report
Banca ore SHALL offer a separate report preview with a choice of Centrale, Succursale or both sedi. The preview SHALL identify the selection and provide print and return actions. Printing SHALL support saving to PDF through the browser.

#### Scenario: Print a single sede
- **WHEN** a user selects Centrale and opens and prints the report
- **THEN** the preview and printed report identify Centrale and contain only its summary and assignments

#### Scenario: Print both sedi
- **WHEN** a user selects both sedi and opens the report
- **THEN** the report includes both sede summaries and assignments and identifies the combined scope

### Requirement: Financial summary retains accounting meaning
The report SHALL show the selected sedi's committed cost, configured budget, percentage used and remaining amount or excess, using the existing Banca ore financial totals and their qualifications.

#### Scenario: Missing or zero budget and unpriced hours
- **WHEN** a selected sede has no configured budget, a zero budget or unpriced hours
- **THEN** the report identifies the unavailable percentage or missing budget and labels unpriced hours and partial totals as applicable

#### Scenario: Combined configured budgets
- **WHEN** both sedi are selected and only one has a configured budget
- **THEN** the report identifies the scope of the combined percentage and retains the total cost across both sedi

### Requirement: Complete paid assignment register
The report SHALL include all recorded paid assignments for the selected sedi, grouped by teacher and showing teacher, date, hour, class, sede, assigning author and cost or an unpriced indication. It SHALL state that future and review-flagged assignments are included and that the selected availability week does not limit the report.

#### Scenario: Empty selection
- **WHEN** no assignments exist for the selected sede
- **THEN** the report displays an explicit empty-register message

#### Scenario: Long register
- **WHEN** the register spans multiple pages
- **THEN** all selected assignments remain readable and table headings are repeated as needed

### Requirement: Consistent report presentation
The report SHALL use the Statistiche report's visual style and header, including branding and generation time, and remain legible in preview and print. The existing weekly availability PDF SHALL remain available separately.

#### Scenario: Existing availability export
- **WHEN** the user requests the existing availability PDF
- **THEN** it continues to export the selected week's availability independently of the financial report
