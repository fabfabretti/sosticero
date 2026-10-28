# Proposal

## Why

Empty hours on Supplenze currently offer no way to consult potential substitutes. Staff need to inspect availability even when there is no absence to cover, using the campus tab already selected.

## What Changes

- Add “Consulta disponibilità” to each hour with no substitution rows in the selected campus view.
- Open a read-only availability list for the selected day and hour, with teacher names, availability types and campus labels.
- Centrale and Succursale open their own campus directly; Entrambe shows both campuses clearly labelled.
- Reuse existing availability policies and restrictions without creating a substitution or allowing assignments from consultation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `substitution-rows`: Empty-hour consultation entry and campus-aware, read-only availability inspection.

## Impact

Frontend Supplenze table and candidate drawer, backend read endpoint and shared eligibility logic, API authorization and focused regression tests. No schema changes, dependencies, operational data changes, PDF changes or deployment are required by this proposal.
