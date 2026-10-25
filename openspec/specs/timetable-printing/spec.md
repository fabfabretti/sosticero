# timetable-printing Specification

## Purpose

Allow staff to download a complete, readable weekly teacher timetable as a regularly formatted PDF for printing and sharing.

## Requirements

### Requirement: Complete saved timetable download
Orari SHALL offer a PDF download of all active teachers with scheduled lessons or receptions, ordered alphabetically by displayed name, regardless of the teacher search filter. The export SHALL use saved data valid on the selected “Orario al” date, including applicable saved overrides and displayed teacher names.

#### Scenario: Search does not restrict export
- **WHEN** a search displays only one teacher and the user exports the timetable
- **THEN** the PDF includes every eligible teacher in alphabetical order

#### Scenario: Selected date and saved changes
- **WHEN** the user exports a historical or future selected date with saved timetable overrides
- **THEN** the PDF uses the saved schedule valid on that date and current displayed teacher names

### Requirement: Regular two-teacher page layout
The PDF SHALL use A4 landscape pages with two teacher grids stacked vertically, Monday–Friday columns and hours 1–7 rows. All timetable body cells SHALL have identical width and height throughout the document. Each grid SHALL stay on one page and identify its teacher. An odd final teacher SHALL occupy the upper position without enlarging its grid.

#### Scenario: Odd teacher count
- **WHEN** five teachers are exported
- **THEN** three pages contain two, two and one teacher grids respectively, with identical body cell dimensions

### Requirement: Complete lesson and location content
Each occupied cell SHALL show its class and activity codes, available aula name and campus using C for Centrale, S for Succursale and ? for unknown campus. For lessons without activity codes, missing aula SHALL be marked “Aula n.d.”. For other activities, unavailable room and campus details SHALL be omitted. Empty slots SHALL remain blank. Text SHALL wrap within cells without silent truncation or overlapping borders.

#### Scenario: Known and unknown locations
- **WHEN** one lesson has aula LAB.T in Succursale and another has no room or campus
- **THEN** their cells show LAB.T / S and Aula n.d. / ? respectively

### Requirement: Inline compresenza partners
Each compresenza cell SHALL list all distinct other teachers sharing any of its classes at the same weekday and hour, using their displayed names. The teacher whose grid is printed SHALL be excluded from the partner list.

#### Scenario: Multiple partners
- **WHEN** three teachers share a class and hour
- **THEN** each teacher's corresponding cell prints the other two names inline

#### Scenario: Partner shares multiple classes
- **WHEN** the same partner shares two classes in the same slot
- **THEN** the partner is listed only once in that cell

### Requirement: Page context and saved annotations
Every page SHALL repeat the selected date, timetable effective date when available, page numbering and a compact legend explaining campus, missing-room and annotation abbreviations used. Saved receptions SHALL appear with available time and location details, including alongside lessons. Substitution availability flags SHALL NOT appear in this general-purpose timetable.

#### Scenario: Reception overlaps a lesson
- **WHEN** a saved reception overlaps a lesson
- **THEN** both appear in the cell with an overlap annotation explained by the legend

### Requirement: Safe export states
Export SHALL be unavailable while the selected date is loading, has no eligible teachers, or unsaved timetable or teacher-name edits exist. Generation SHALL leave stored data unchanged. A generation failure, including content that cannot fit without loss, SHALL show an actionable error rather than offer an incomplete PDF.

#### Scenario: Unsaved edits
- **WHEN** a timetable or teacher-name draft is open
- **THEN** export is disabled and the user is told to save or cancel edits first

#### Scenario: Content cannot fit
- **WHEN** complete cell content cannot fit within the fixed grid at the supported readable font size
- **THEN** generation fails visibly without silently omitting names or changing the two-teacher layout

### Requirement: Activity colors and extractable text
The PDF SHALL distinguish lessons, other activities and receptions with light colors explained in the page legend. Reception overlaps SHALL retain both activity and reception colors. Timetable content SHALL remain selectable and machine-extractable text, rather than a raster image.

#### Scenario: General-purpose timetable
- **WHEN** a teacher has a lesson, STAFF without location data, and a reception
- **THEN** the three categories use distinct colors, STAFF has no missing-location placeholders, and text extraction recovers the teacher name and timetable content
