# Spec Delta

## Purpose

Provide printable daily substitution sheets for office use, preserving the school's paper layout and room for handwritten additions in campus-specific A3 PDFs.

## ADDED Requirements

### Requirement: Daily export with explicit campus selection
The system SHALL offer a print/PDF action for the selected day and require a choice of Centrale, Separata, or both before generating the document. Both SHALL produce one PDF with each campus starting on its own sheet. The document SHALL be available for download and printing without changing operational data or the JSON backup export.

#### Scenario: Export both campuses
- **WHEN** the user selects both campuses for a day
- **THEN** one PDF contains Centrale followed by Separata, starting on separate pages
- **AND** each campus's main table contains only its substitution rows

#### Scenario: Export one campus
- **WHEN** the user selects Separata
- **THEN** only that campus's sheet is generated for the selected date
- **AND** saved operational data is unchanged

### Requirement: Complete A3 office sheet
The document SHALL use A3 portrait and reproduce the reference sheet's structure: school, campus and date header; main substitution table; and lower sections for Classe / Docenti accompagnatori in uscita and Docenti a disposizione. The main columns SHALL be Ora, Docente assente, Classe, Aula / sede, Docente supplente, Tipo and Firma.

#### Scenario: Complete sheet for an empty day
- **WHEN** a campus has no substitutions on the selected day
- **THEN** its A3 sheet still contains the header, all main columns and both lower sections with writing space

### Requirement: Preserve daily substitution meaning
The main table SHALL use the selected day's existing grouped substitution rows, preserve all absent names for a merged row, and print the assigned teacher and existing type code, including POT, C, RP, D and RC. Unassigned rows SHALL retain blank substitute and type cells. Special assignments SHALL use their existing human-readable meaning.

#### Scenario: Merged row with assignment
- **WHEN** two absent teachers share a row assigned with type RP
- **THEN** the printout shows both absent names, one substitution and RP in Tipo

#### Scenario: Unassigned or special row
- **WHEN** a row is unassigned or has an entry/exit or uncovered assignment
- **THEN** an unassigned row has blank assignment cells and a special row displays its existing meaningful label rather than an internal identifier

### Requirement: All periods with handwriting space
Every campus's main table SHALL contain periods 1–7, even when empty. Each period SHALL have at least eight total rows and include all its entries plus at least two empty ruled rows for handwriting. Boundaries between periods SHALL use thicker rules. Busy periods SHALL expand rather than discard entries or consume the two blank rows. Text and writing space SHALL remain readable when content overflows.

#### Scenario: Uneven period sizes
- **WHEN** period 1 has no entries and period 2 has twelve
- **THEN** period 1 has at least eight blank rows and period 2 has twelve populated rows plus at least two blank rows

### Requirement: Independent absent-class and accompanying-teacher lists
The lower-left section SHALL list the day's explicitly recorded absent classes and teachers whose absence or permit is tagged In gita, independently. It SHALL NOT infer absent classes from teacher timetables or imply a class-to-teacher pairing. Both lists SHALL retain blank space for handwritten additions.

#### Scenario: Multiple classes and accompanying teachers
- **WHEN** two classes are recorded absent and three teachers have In gita absences
- **THEN** the section lists the two recorded classes and the three tagged teachers without pairing them
- **AND** a class taught by one of those teachers is not added merely because it appears in their timetable

### Requirement: Original A disposizione with assigned names crossed out
The lower-right section SHALL show teachers in the app's A disposizione section for each period 1–7, including its manual and automatic entries, in one comma-separated list that wraps within a single row per period. Teachers assigned a supplenza SHALL remain listed with their names crossed out in the assigned periods. Other candidate types SHALL NOT be included merely because they are eligible to substitute.

#### Scenario: Assignment retains availability listing
- **WHEN** a teacher is A disposizione in periods 2 and 3 and assigned a supplenza in period 2
- **THEN** their name appears crossed out in period 2 and normally in period 3

#### Scenario: POT candidate without disposition
- **WHEN** a teacher is a POT candidate but is not in A disposizione for that period
- **THEN** they are absent from the lower-right section for that period

### Requirement: Readable continuation and prominent document page counters
Content exceeding a page SHALL continue onto additional A3 portrait pages without shrinking to fit. Continuations SHALL identify date, campus and table headings. Whenever the complete PDF has more than one page, every page SHALL show a large, prominent PAGE X/N indicator at both top and bottom, with X and N counting the complete PDF.

#### Scenario: Busy campus continues
- **WHEN** one campus's entries and blank writing rows exceed one page
- **THEN** all rows continue onto further pages with identifiable periods and no clipped entries
- **AND** each page shows PAGE X/N prominently at top and bottom

#### Scenario: Both campuses fit one sheet each
- **WHEN** both campuses each occupy one page
- **THEN** the first page shows PAGE 1/2 and the second PAGE 2/2 at both top and bottom

#### Scenario: Single-page export
- **WHEN** the entire selected export fits on one page
- **THEN** multipage warning indicators are not required
