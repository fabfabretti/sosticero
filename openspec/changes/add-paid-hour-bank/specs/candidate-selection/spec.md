## ADDED Requirements

### Requirement: Explicit paid candidate choice
The drawer SHALL show Disponibile a pagamento immediately after Recuperi permesso · ore favorevoli and before other recoveries. A teacher qualifying for both SHALL appear in both sections with distinct selectable categories and existing profile details. Clicking recovery SHALL consume eligible debt; clicking paid SHALL record a paid hour without consuming debt. The saved category SHALL be visible after reload.

#### Scenario: Same teacher offered twice
- **WHEN** Rossi qualifies for favourable recovery and paid availability in the selected slot
- **THEN** both choices appear
- **AND** choosing paid leaves permit debt unchanged, while choosing recovery reduces eligible debt by one

### Requirement: Fair paid candidate ordering
Paid candidates SHALL sort by ascending total saved paid assignments across all current data, including future assignments. Ties SHALL sort by displayed name then stable teacher identity. Existing class familiarity, daily workload and other-category ordering SHALL NOT override paid totals within the paid section. Each entry SHALL expose its paid count.

#### Scenario: Future hours influence order
- **WHEN** Rossi has one past and two future paid assignments and Bianchi has two past paid assignments
- **THEN** Bianchi precedes Rossi regardless of class familiarity or total non-paid substitutions

### Requirement: Paid candidate restrictions
A paid choice SHALL require a declared recurring slot and an active teacher free from scheduled activities, reception, daily absence, manual ordinary availability and another assignment in that period. Known impossible campus transfers SHALL block it. Unknown campus feasibility SHALL leave it selectable with Sede da verificare at either campus. Server validation SHALL enforce these constraints regardless of submitted category.

#### Scenario: Cannot buy out a commitment
- **WHEN** a declared paid slot overlaps a scheduled lesson, reception, absence or another substitution
- **THEN** a new paid assignment is rejected without changing records or debt

#### Scenario: Unknown campus warning
- **WHEN** a teacher's relevant timetable campus is missing and no known travel conflict exists
- **THEN** the paid section offers them for either target campus with Sede da verificare

### Requirement: Atomic explicit assignment category changes
Teacher and selected category SHALL identify a candidate choice. Saving or switching category SHALL atomically update the assignment and accounting. Switching recovery to paid SHALL release its linked recovery; switching paid to recovery SHALL require and consume eligible debt. An identical resave SHALL preserve metadata and count once. Legacy requests without a category SHALL retain their existing behavior and SHALL NOT create paid assignments implicitly.

#### Scenario: Same-teacher category switch
- **WHEN** Rossi's recovery assignment is explicitly changed to paid
- **THEN** the recovery hour is released and one paid hour is counted in the same transaction
- **AND** reversing the switch consumes eligible debt and removes the paid contribution

#### Scenario: Rejected switch and double booking
- **WHEN** a requested paid-to-recovery switch has no eligible debt, or concurrent requests book the same teacher-period
- **THEN** the invalid operation fails without partial accounting changes and at most one competing booking succeeds

#### Scenario: Resave and metadata
- **WHEN** an unchanged paid teacher/category is saved again
- **THEN** the assigning account, notification state and single paid contribution are preserved
- **WHEN** the teacher or category changes
- **THEN** notification state resets and the new paid choice records the acting account
