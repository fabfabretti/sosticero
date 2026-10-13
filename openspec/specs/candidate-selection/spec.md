# Candidate Selection Specification

## Purpose

Defines how the office picks a substitute for an uncovered class and period: which candidate information is shown when choosing, how the entry/exit options behave, and which availability appears automatically in the sidebar.

## Requirements

### Requirement: Candidate profile in the drawer
The candidate list for a row SHALL present, for every teacher candidate, the candidate's teaching role (`curricolare`, `ITP` or `sostegno`), the classe di concorso code together with its Italian name when a name is known, and the classes the candidate teaches across the whole week. A candidate who already teaches the class of the row anywhere in the week SHALL be flagged with a badge naming that class.

#### Scenario: ITP compresenza candidate shows profile
- **WHEN** the candidate list for a class contains an ITP teacher offered as compresenza
- **THEN** the candidate entry shows the role `ITP`, the classe di concorso code, and its Italian name

#### Scenario: Sostegno candidate shows profile
- **WHEN** the candidate list contains a sostegno teacher
- **THEN** the candidate entry shows the role `sostegno`

#### Scenario: Teacher already teaching the covered class is badged
- **WHEN** a candidate teaches the covered class in any of the classes of their weekly timetable
- **THEN** the candidate entry shows a badge naming that class

#### Scenario: Unrelated candidate has no badge
- **WHEN** a candidate teaches none of the classes matching the covered class in their weekly timetable
- **THEN** the candidate entry shows no badge

### Requirement: Automatic availability in the sidebar
A teacher SHALL appear in the sidebar "A disposizione" list whenever, for a given hour, all the classes the teacher is scheduled to teach that hour are out (the class enters later, leaves earlier, or is marked out), the teacher is not absent, and the teacher is not already assigned. The computed hours SHALL be shown selected but locked, with a tooltip naming the cause. All other hours on that teacher SHALL remain editable as manual availability.

#### Scenario: Class enters later frees the compresenza teacher
- **WHEN** a class is marked as entering later and its compresenza teacher is scheduled in that class that hour
- **THEN** the teacher appears in the "A disposizione" list with that computation hour selected and locked
- **AND** hovering shows the class and the cause

#### Scenario: Locked computed hour cannot be deselected
- **WHEN** a teacher with a locked computed hour has other hours in the same list entry
- **THEN** the locked hour cannot be toggled off
- **AND** the other hours can be toggled normally as manual availability

#### Scenario: Class-out cause is explained
- **WHEN** the teacher's scheduled class is marked out for that hour
- **THEN** the locked hour's tooltip names that class and the class-out cause

#### Scenario: Absent teacher is not automatically available
- **WHEN** a teacher is themselves absent for that hour
- **THEN** they do not appear as automatically available for that hour

### Requirement: Entry and exit options always visible
The candidate list for a row SHALL always include the entry and exit options, each labelled with the class's effective entry and exit hours. An option SHALL be selectable only when the row's hour is the class's first effective hour (entry) or last effective hour (exit), where effective hours are the class's scheduled hours minus hours already made out by entry/exit assignments or class-out entries. Otherwise the option SHALL be shown greyed and its assignment SHALL be rejected.

#### Scenario: Entry available at the first effective hour
- **WHEN** the row's hour is the class's first effective hour
- **THEN** the entry option is selectable
- **AND** the exit option is greyed

#### Scenario: Exit available at the last effective hour
- **WHEN** the row's hour is the class's last effective hour
- **THEN** the exit option is selectable
- **AND** the entry option is greyed

#### Scenario: Mid-schedule row greys both options
- **WHEN** the row's hour is neither the class's first nor last effective hour
- **THEN** both entry and exit options are greyed

#### Scenario: Exit chains across consecutive hours
- **WHEN** the exit option has been assigned to the class's last scheduled hour and a row remains at the new last effective hour
- **THEN** the exit option is selectable for that new last effective hour

#### Scenario: Greyed option assignment is rejected
- **WHEN** a request assigns an entry or exit option to a row whose hour is not the corresponding effective boundary
- **THEN** the server rejects the request
- **AND** no assignment is stored

### Requirement: Candidate type policy
Candidate selection SHALL apply the effective hour type's availability and visibility policies. Hidden types SHALL not be offered or newly assigned. Available visible types SHALL be normally selectable. Visible unavailable types SHALL appear after normal candidates under Solo in caso di necessità, labelled Occupato and with their type badge. Existing profile information SHALL remain visible.

#### Scenario: Potenziamento becomes available
- **WHEN** PE is configured available and visible
- **THEN** eligible teachers with PE at the requested hour are offered as normal candidates

#### Scenario: Hidden compresenza
- **WHEN** Compresenza ITP visibility is turned off
- **THEN** teachers whose effective type is Compresenza ITP are omitted from candidate selection
- **AND** direct new-assignment requests for those hidden candidates are rejected

#### Scenario: Separate fallback types
- **WHEN** Compresenza ITP and Sostegno are visible and unavailable
- **THEN** eligible teachers of each type appear in the exceptional group with distinct badges and their existing teacher profiles

### Requirement: Explicit exceptional assignment
Assigning a visible unavailable candidate SHALL require an explicit exceptional action and confirmation naming the teacher, hour and occupied type. The server SHALL reject the assignment without that confirmation. Absence, double booking, retired teachers and hidden types SHALL remain non-overridable restrictions.

#### Scenario: Confirmed compresenza exception
- **WHEN** the office selects Usa comunque for a visible occupied compresenza candidate and confirms
- **THEN** the assignment is accepted if no hard restriction applies and records that it was exceptional

#### Scenario: Cancel exceptional action
- **WHEN** the office cancels exceptional-assignment confirmation
- **THEN** no assignment changes

#### Scenario: Direct assignment without confirmation
- **WHEN** an API request assigns an occupied candidate without explicit exceptional confirmation
- **THEN** the server rejects it

#### Scenario: Hard restriction wins
- **WHEN** an absent or already assigned teacher is requested with exceptional confirmation
- **THEN** the server rejects it with the existing restriction reason

### Requirement: Policy changes preserve historical assignments
Changing type rules SHALL affect subsequent candidate selection and assignment validation without deleting or rewriting existing assignments. A previously assigned teacher SHALL remain identifiable even if their type becomes hidden or unavailable.

#### Scenario: Hide an assigned type
- **WHEN** the office hides a type with existing assignments
- **THEN** those assignments remain displayed and stored while that type is excluded from new choices

### Requirement: Effective type precedence
Existing manual availability and automatic class-out release SHALL remain effective as A disposizione. Otherwise imported activity codes SHALL take precedence over derived teaching types. Sostegno SHALL be distinct from Compresenza ITP; ordinary teaching SHALL use Lezione. Multiple applicable activity codes SHALL use restrictive availability and visibility, and SHALL retain all labels for explanation.

#### Scenario: Class out frees a support teacher
- **WHEN** all classes of a non-absent, unassigned support teacher are out for the hour
- **THEN** the existing automatic availability behavior remains and the candidate uses A disposizione policy

#### Scenario: Explicit GM commitment with a class field
- **WHEN** a timetable hour has GM and a class reference
- **THEN** the GM policy applies rather than silently treating the hour as ordinary teaching or compresenza

#### Scenario: Conflicting activities
- **WHEN** a teacher's hour contains two distinct codes and either code is hidden or unavailable
- **THEN** the candidate is hidden if either is hidden and exceptional if both are visible but either is unavailable

### Requirement: Normal candidate ordering and manual options
Normally available candidates SHALL retain existing category and campus ordering where applicable. Newly supported activity types SHALL use the potenziamento tier. Convenient RP candidates SHALL precede ordinary candidates. Other RP candidates SHALL follow all other choices, including exceptional occupied candidates. Existing relative ordering of non-RP choices SHALL remain unchanged. Dirigente and entry/exit options SHALL retain their existing behavior and SHALL not be treated as imported hour types.

#### Scenario: Newly supported activity ranking
- **WHEN** RIT becomes available and visible
- **THEN** its candidates use the potenziamento tier with existing campus, load and name tie breakers

#### Scenario: Entry and exit unaffected
- **WHEN** type settings change
- **THEN** entry and exit options retain their existing effective-boundary visibility and validation

### Requirement: RP eligibility and category precedence
Teachers with date-eligible permit capacity SHALL be offered as RP (Recupero permesso) in otherwise unscheduled hours. Normal availability SHALL retain its category and SHALL NOT consume permit hours. RP SHALL NOT override scheduled activities, absence, retirement, double booking or unsafe campus transfers. Existing candidate profiles SHALL remain visible.

#### Scenario: Free teacher with debt
- **WHEN** a teacher has an eligible outstanding hour and no commitment in the selected period
- **THEN** the teacher appears with the RP badge and remaining eligible hours

#### Scenario: Normal availability wins
- **WHEN** a teacher with debt is available through POT, manual availability or automatic class-out release
- **THEN** their existing category applies and assignment consumes no permit hour

#### Scenario: Hard restrictions remain
- **WHEN** a teacher with debt is absent, retired, already assigned elsewhere in the period or has a scheduled activity
- **THEN** RP cannot be used to bypass the restriction

#### Scenario: No eligible debt
- **WHEN** all permit hours are recovered, expired or dated after the selected substitution date
- **THEN** no new RP assignment is offered or accepted

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
- **THEN** otherwise eligible RP hours appear at the bottom

### Requirement: Atomic RP assignment lifecycle
The server SHALL select and validate the permit in the same transaction as assignment saving. Replacing or deleting an RP assignment SHALL release its hour atomically. Re-saving the same assignment SHALL preserve its link and SHALL NOT consume another hour. Existing assignments SHALL NOT invalidate themselves by consuming the last hour; review flags SHALL NOT silently refund recovery.

#### Scenario: Competing requests for last hour
- **WHEN** two requests attempt to consume a teacher's final eligible permit hour
- **THEN** at most one succeeds and the other fails without partial changes

#### Scenario: Replace or delete
- **WHEN** an RP assignment is removed or replaced with another teacher
- **THEN** its linked permit regains one available hour

#### Scenario: Final-hour validation
- **WHEN** a saved RP assignment consumed its permit's final hour
- **THEN** reloading and statistics validation retain its recovery and do not flag insufficient balance for that assignment

#### Scenario: Timetable changes
- **WHEN** a later timetable changes the teacher's availability or the assignment requires review
- **THEN** the stored RP category and permit link remain until the assignment is explicitly changed or removed
