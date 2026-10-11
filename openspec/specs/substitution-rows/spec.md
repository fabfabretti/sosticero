# Substitution Rows Specification

## Purpose

Define how the daily substitution table turns absences into rows and how each row's candidate list is derived, so that one class and period in one room is never split across multiple substitutions.

## Requirements

### Requirement: Group co-absent teachers into a single substitution row
When two or more teachers are absent for the same class in the same period, the substitution table SHALL present a single row for that class and period. The row's absent-teacher label SHALL list every absent teacher in the group, joined in name order. A class and period with a single absent teacher SHALL keep its existing single-teacher row.

#### Scenario: Two co-teachers absent together
- **WHEN** Domaschi and Savelli are both absent in the same period for class 3FB
- **THEN** the table shows one row for 3FB in that period
- **AND** its absent-teacher label lists both names in name order

#### Scenario: Three or more co-teachers absent together
- **WHEN** three teachers who share a class and period are all absent
- **THEN** the table shows one row whose label lists all three names

#### Scenario: Single absence is unchanged
- **WHEN** only one of two co-teachers is absent
- **THEN** the table still shows one row for that absent teacher only

### Requirement: Merged row carries one substitution and excludes every absent co-teacher
A merged row SHALL carry exactly one substitution. The candidate list for a row SHALL exclude every teacher who is absent for that class and period, not only the row's canonical teacher.

#### Scenario: Absent co-teachers are not candidates
- **WHEN** the office opens the candidate list for a merged row
- **THEN** none of the absent teachers in that row is offered as a candidate

#### Scenario: Present co-teacher remains a candidate
- **WHEN** one of two co-teachers is absent and the other is present
- **THEN** the present co-teacher is offered as a Compresenza candidate

### Requirement: Row identity preserves the archive format
A row's identifier SHALL keep the `<teacher>|<period>|<class>` form, using the lowest teacher id in the group as the canonical teacher for a merged row. Substitutions SHALL continue to import and export under the existing archive schema. A stored substitution whose key is no longer a row identifier SHALL be flagged for review, not migrated or deleted.

#### Scenario: Merged row uses the canonical key
- **WHEN** teachers d056 and d134 are both absent for class 3FB in period 7
- **THEN** the merged row's identifier is `d056|7|3FB`

#### Scenario: Orphaned assignment is flagged
- **WHEN** a substitution is stored under a key that is no longer a row identifier after co-absence changes
- **THEN** the day view reports it as an assignment to verify
- **AND** it is not silently deleted

### Requirement: Merging includes ITP and sostegno absences
Merging SHALL apply to co-teachers regardless of role, including curricolare, ITP and sostegno, for the time being.

#### Scenario: Curricolare and ITP absent together
- **WHEN** a curricolare teacher and an ITP teacher are both absent for the same class and period
- **THEN** they share one substitution row

#### Scenario: Sostegno absence merges
- **WHEN** a sostegno co-teacher is absent together with another co-teacher for the same class and period
- **THEN** they share one substitution row