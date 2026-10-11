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