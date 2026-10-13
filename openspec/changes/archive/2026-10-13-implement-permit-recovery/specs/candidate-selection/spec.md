# Spec Delta

## MODIFIED Requirements

### Requirement: Normal candidate ordering and manual options
Normally available candidates SHALL retain existing category and campus ordering where applicable. Newly supported activity types SHALL use the potenziamento tier. Convenient RP candidates SHALL precede ordinary candidates. Other RP candidates SHALL follow all other choices, including exceptional occupied candidates. Existing relative ordering of non-RP choices SHALL remain unchanged. Dirigente and entry/exit options SHALL retain their existing behavior and SHALL not be treated as imported hour types.

#### Scenario: Newly supported activity ranking
- **WHEN** RIT becomes available and visible
- **THEN** its candidates use the potenziamento tier with existing campus, load and name tie breakers

#### Scenario: Entry and exit unaffected
- **WHEN** type settings change
- **THEN** entry and exit options retain their existing effective-boundary visibility and validation

## ADDED Requirements

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
