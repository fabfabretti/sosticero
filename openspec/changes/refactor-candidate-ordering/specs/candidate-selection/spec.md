# Candidate Selection Delta

## MODIFIED Requirements

### Requirement: Candidate profile in the drawer
The candidate list for a row SHALL present, for every teacher candidate, the candidate's teaching role (`curricolare`, `ITP` or `sostegno`), the classe di concorso code together with its Italian name when a name is known, and the classes the candidate teaches across the whole week. A candidate who teaches the covered class anywhere in the week SHALL show a star labelled “Insegna nella classe”. A candidate whose nonempty CDC matches the teacher of the lesson being substituted at the selected hour SHALL show a star labelled “Insegna la stessa CDC”. Both labels SHALL appear when both apply.

#### Scenario: ITP compresenza candidate shows profile
- **WHEN** the candidate list for a class contains an ITP teacher offered as compresenza
- **THEN** the candidate entry shows the role `ITP`, the classe di concorso code, and its Italian name

#### Scenario: Sostegno candidate shows profile
- **WHEN** the candidate list contains a sostegno teacher
- **THEN** the candidate entry shows the role `sostegno`

#### Scenario: Teacher already teaching the covered class is badged
- **WHEN** a candidate teaches the covered class in any of the classes of their weekly timetable
- **THEN** the candidate entry shows a star labelled “Insegna nella classe”

#### Scenario: Unrelated candidate has no badge
- **WHEN** a candidate teaches none of the classes matching the covered class in their weekly timetable
- **THEN** the candidate entry shows no badge

#### Scenario: CDC match for the substituted lesson
- **WHEN** a candidate has the same nonempty CDC as the absent teacher for the selected substitution hour
- **THEN** the candidate shows “Insegna la stessa CDC” with a star
- **AND** a match to an unrelated absent teacher or another hour does not qualify

#### Scenario: Both matches and missing CDC
- **WHEN** a candidate teaches the class and matches the substituted teacher's CDC
- **THEN** both star labels appear
- **AND** two missing CDC values never count as a match

### Requirement: Candidate type policy
Candidate selection SHALL apply the effective hour type's availability and visibility policies. Hidden types SHALL not be offered or newly assigned. Available visible types SHALL be normally selectable. Visible unavailable types marked Presso questa scuola SHALL appear in the exceptional fallback tier, labelled Occupato and with their type badge. Visible unavailable types outside this school or with unset school membership SHALL not be offered. Same-class ITP/support compresenza SHALL retain its normal first-tier treatment when visible. Existing profile information SHALL remain visible.

#### Scenario: Potenziamento becomes available
- **WHEN** PE is configured available and visible
- **THEN** eligible teachers with PE at the requested hour are offered as normal candidates

#### Scenario: Hidden compresenza
- **WHEN** Compresenza ITP visibility is turned off
- **THEN** teachers whose effective type is Compresenza ITP are omitted from candidate selection
- **AND** direct new-assignment requests for those hidden candidates are rejected

#### Scenario: Separate fallback types
- **WHEN** ITP/support commitments in another class are visible, unavailable and marked Presso questa scuola
- **THEN** eligible teachers of each type appear in the exceptional group with distinct badges and their existing teacher profiles

### Requirement: Normal candidate ordering and manual options
Candidates SHALL follow the ordered tiers defined below. Hard-block reasons SHALL disable selection without affecting ranking. Within each tier, class-or-CDC affinity SHALL precede lower daily load, lower total load, case-insensitive name and stable ID. Either affinity match SHALL give equal preference; both SHALL give no additional preference. RP convenience SHALL precede affinity within RP only. Existing workload totals SHALL remain unchanged.

#### Scenario: Explicit complete hierarchy
- **WHEN** the drawer has candidates from every category
- **THEN** it orders them as follows:
  1. ITP/support compresenza already in the covered class at that hour.
  2. Entry/exit options, including disabled options.
  3. DISP and DI.S availability.
  4. Same-campus available POT and other settings-enabled activity types, including staff, PE and ALF.
  5. Dirigente and same-campus UTC/UTS.
  6. Different-campus available POT and other activity types, including UTC/UTS.
  7. Available activities whose campus relationship cannot be established.
  8. RP, with favourable hours before other RP.
  9. Visible unavailable in-school commitments requiring exceptional confirmation.
  10. Scoperta, always the final row.

#### Scenario: Campus resolution
- **WHEN** candidates include DI.S, UTC, UTS and DISP
- **THEN** DI.S and UTC use centrale, UTS uses succursale, and automatic DISP inherits the released lesson's campus
- **AND** manual DISP retains an explicitly supplied campus, otherwise its lesson campus if known
- **AND** DISP/DI.S stay in their availability tier even when from another or unknown campus
- **AND** Dirigente stays in tier 5 for either campus

#### Scenario: Newly supported activity ranking
- **WHEN** RIT becomes available and visible
- **THEN** its candidates use the same-campus, different-campus or unknown-campus available-activity tier
- **AND** importing a different activity code does not silently give it the rottura-compresenza rank

#### Scenario: Affinity and workload ties
- **WHEN** candidates belong to the same tier and RP convenience subgroup if applicable
- **THEN** teaching the class or matching the substituted lesson teacher's CDC ranks before no match
- **AND** ties use fewer assignments today, then fewer total assignments, then name and stable ID
- **AND** neither low workload nor affinity promotes a candidate across tiers

#### Scenario: Blocked candidates retain position
- **WHEN** a normally ranked teacher is absent or already assigned at the requested hour
- **THEN** the teacher retains their tier and tie-break position with a disabled action and the specific reason
- **AND** exceptional confirmation cannot bypass the restriction

#### Scenario: Entry and exit unaffected
- **WHEN** type settings change
- **THEN** entry and exit options retain their existing effective-boundary visibility and validation

#### Scenario: Drawer explanations reflect the ranking
- **WHEN** the office reads the list headings and priority explanation
- **THEN** those explanations match the hierarchy and distinguish favourable RP from other RP without regrouping the server order

### Requirement: Convenient RP periods
An RP period SHALL be convenient if immediately before or after a teaching period, or inside a gap between teaching periods that day, and campus transfers are feasible on both sides. Intervalli SHALL be the boundaries 2–3 and 4–5. A transfer between different known campuses SHALL require an intervening intervallo. Missing campus information SHALL NOT establish convenience.

#### Scenario: Same-campus teaching pattern
- **WHEN** a teacher teaches periods 2, 3 and 5 in centrale
- **THEN** free periods 1, 4 and 6 are convenient RP periods for centrale
- **AND** free period 7 is a non-convenient RP period

#### Scenario: Gap spanning multiple periods
- **WHEN** a teacher teaches periods 2 and 6 in centrale
- **THEN** otherwise free periods 3, 4 and 5 are convenient for centrale

#### Scenario: Adjacent cross-campus period with break
- **WHEN** a teacher teaches period 3 in centrale and is requested for period 2 in succursale with no preceding conflict
- **THEN** the 2–3 intervallo permits the transfer and the RP period is convenient

#### Scenario: Adjacent transfer without break
- **WHEN** a teacher teaches period 2 in centrale and is requested for period 1 in succursale
- **THEN** the transfer lacks an intervallo and the RP assignment is blocked

#### Scenario: Both sides of gap matter
- **WHEN** a teacher teaches periods 3 and 5 in centrale and is requested for period 4 in succursale
- **THEN** the 4–5 intervallo does not compensate for the missing 3–4 intervallo
- **AND** the RP assignment is blocked

#### Scenario: No teaching that day
- **WHEN** a teacher has eligible debt but no teaching periods that day
- **THEN** otherwise eligible RP hours appear in the non-favourable RP subgroup, after favourable RP and before exceptional commitments and Scoperta
