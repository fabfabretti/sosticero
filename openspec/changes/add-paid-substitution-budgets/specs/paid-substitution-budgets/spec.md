## Purpose

Let administrators configure paid-substitution funding and rates, and let operators inspect committed costs and optional budget usage without preventing urgent assignments.

## ADDED Requirements

### Requirement: Optional campus financial configuration
Administrators SHALL configure an optional euro budget and optional laureato/diplomato hourly rates independently for each sede under Amministrazione → Configurazione. Blank SHALL mean unconfigured, distinct from zero. Amounts SHALL be nonnegative with at most two decimal places. No school-year partition or automatic reset SHALL be introduced.

#### Scenario: Configure example amounts
- **WHEN** an administrator saves a budget of 3406.12 and rates of 31.11 and 28.74 for Centrale
- **THEN** those values persist and display in Italian euro formatting independently of Succursale
- **AND** no example value is installed automatically

#### Scenario: Invalid amounts and unauthorized writes
- **WHEN** a nonadministrator submits configuration or an administrator submits negative or overprecision amounts
- **THEN** the operation fails without partial configuration or assignment changes

### Requirement: Automatic pay classification
Pricing SHALL default teachers marked ITP to diplomato and other teachers to laureato. Administrators SHALL be able to override or reset that classification per stable teacher identity. Saving classification changes SHALL recalculate affected existing and future paid assignments as well as new pricing.

#### Scenario: Classification exception
- **WHEN** an administrator overrides an ITP teacher to laureato
- **THEN** subsequent pricing uses the laureato rate of the substitution's sede
- **AND** resetting the override restores role-based classification

### Requirement: Recalculable assignment costs
Each priced paid assignment SHALL store its hourly amount and pay classification, charging its saved substitution sede. Each saved period SHALL count as one paid hour, including future assignments. Identical assignment saves and notification or timetable changes SHALL preserve its cost until financial settings are saved. Removing or replacing it SHALL remove its contribution; a new paid choice SHALL use current pricing.

#### Scenario: Rates change after booking
- **WHEN** an administrator changes a tariff from €31.11 to €32.00 and saves
- **THEN** all applicable stored assignments, including past and future ones, cost €32.00
- **AND** budgets and percentages immediately reflect the recalculated amounts

#### Scenario: Teacher works across sedi
- **WHEN** a teacher normally teaching in Centrale covers a paid period in Succursale
- **THEN** Succursale's tariff and budget apply

### Requirement: Recalculate stored assignments on configuration save
Saving financial configuration SHALL atomically recalculate every stored paid assignment from current applicable rates and classifications. Missing rates or unresolvable context SHALL leave assignments visibly unpriced, counting as hours without implying zero cost. Clearing a rate SHALL remove affected stored costs. Reads and backend module imports SHALL NOT trigger database writes.

#### Scenario: First configuration and repeated saves
- **WHEN** an administrator first saves applicable €31.11/€28.74 rates
- **THEN** existing assignments receive those rates by classification in the same atomic save
- **WHEN** those rates change and are saved again
- **THEN** existing costs are updated rather than preserved at their previous values
- **AND** saving unchanged settings does not duplicate contributions

#### Scenario: Partial configuration and tariff removal
- **WHEN** only Centrale's laureato rate is configured
- **THEN** applicable Centrale laureato assignments receive costs and other assignments remain visibly unpriced
- **WHEN** that configured rate is cleared and saved
- **THEN** its existing assignments return to unpriced and monetary summaries disclose incomplete costs

### Requirement: Assignment-derived financial summaries
Banca ore SHALL summarize all stored paid assignments independently of the grid's reference week, showing each sede's priced committed cost, unpriced hours and optional budget, remaining amount and percentage used. Future and review-flagged assignments SHALL contribute. Budgets SHALL NOT create a separate accounting ledger.

#### Scenario: Example usage
- **WHEN** a sede has one €31.11 assignment and one €28.74 assignment against €3406.12
- **THEN** committed cost is €59.85, remaining budget is €3346.27 and usage displays approximately 1.76%
- **AND** selecting another grid week does not change those totals

### Requirement: Honest combined and zero-budget reporting
With both budgets configured, overall usage SHALL compare their combined priced costs against their combined budgets. With one configured budget, any combined usage SHALL explicitly cover that sede only and show excluded spending separately. With neither, no percentage SHALL be invented. Unpriced hours SHALL mark monetary totals as incomplete. Zero-budget percentage SHALL display as unavailable without division errors.

#### Scenario: One budget missing
- **WHEN** only Centrale has a budget and Succursale has priced assignments
- **THEN** usage is labelled as covering Centrale only and Succursale spending remains visible separately

#### Scenario: Zero and incomplete totals
- **WHEN** a configured zero budget has positive spending or unpriced hours exist
- **THEN** positive spending is shown as over budget without an infinite percentage and unpriced hours are disclosed beside affected totals

### Requirement: Budget overrun is advisory
Exceeding an optional budget SHALL warn operators but SHALL NOT prevent saving a paid assignment or require an extra approval. Warnings SHALL use authoritative post-save accounting. Banca ore SHALL display percentages above 100%, negative remaining amounts and the amount over budget. Existing nonfinancial assignment restrictions SHALL continue to apply.

#### Scenario: Overspending remains allowed
- **WHEN** an otherwise valid assignment raises committed cost from €90 to €121.11 against €100
- **THEN** it saves successfully with an over-budget warning
- **AND** Banca ore shows 121.11% used and €21.11 over budget

### Requirement: Single paid assignment register
Banca ore SHALL retain one detailed paid-assignment table and remove its repeated inline per-teacher totals. The table SHALL preserve teacher, date, period, class, sede, assigning author and notification state, adding applied rate/cost or an explicit unpriced indication. The recurring availability grid SHALL remain separate and unchanged in purpose.

#### Scenario: Inspect paid work once
- **WHEN** an operator opens Banca ore
- **THEN** each paid assignment appears once in the detailed register, newest date first
- **AND** no separate inline teacher totals repeat the register's paid work

### Requirement: Portable and concurrent financial data
Configuration, classification overrides and assignment costs SHALL survive reload, database backups and validated archive round trips. Older archives SHALL load with missing financial configuration and unpriced assignments, without guessed costs. Malformed financial data SHALL reject atomically. Stale configuration saves SHALL conflict and preserve the editor's draft; assignment creation and recalculation SHALL serialize consistently.

#### Scenario: Round trip and invalid archive
- **WHEN** a financial archive is restored
- **THEN** its budgets, overrides and saved costs remain intact
- **WHEN** an archive contains invalid amounts or costs attached to nonpaid work
- **THEN** restoration fails without partial changes

#### Scenario: Concurrent repricing
- **WHEN** rate configuration and assignment creation occur concurrently
- **THEN** the resulting assignment is either priced by the configuration recalculation or by creation using the committed rate, with one contribution only
- **AND** stale configuration cannot overwrite a newer setting
