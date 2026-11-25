# Tasks

## 1. Manual paid assignment and accounting

- [x] 1.1 Add an explicitly confirmed manual-paid assignment path with a persisted manual-origin marker and note, preserving active-teacher, authorization and concurrency checks; verify undeclared availability works only through this path and ordinary paid validation is unchanged in backend tests.
- [ ] 1.2 Integrate manual paid records with existing paid metadata, accounting, budgets and actions; verify paid/free transitions, removal, refusal, unchanged saves, pricing and no permit consumption in backend tests.
- [ ] 1.3 Preserve manual paid origin, notes and metadata through revalidation, review, archive and backup paths; verify round trips and compatibility with existing manual and paid records in backend tests.

## 2. Manual assignment interface

- [x] 2.1 Make the drawer action visibly button-like and add an accessible gratuita/a pagamento choice to the manual dialog, defaulting to gratuita; verify keyboard use, warnings, notes and request payloads in frontend tests.
- [x] 2.2 Restore the saved teacher, payment choice and note when editing manual assignments, including manual paid records; verify editing and paid row actions with frontend tests.
- [x] 2.3 Update paid substitution documentation to explain manual paid assignments and their accounting; check it against the implemented behavior.

## 3. Integration and deployment

- [ ] 3.1 Run relevant backend and frontend tests and production build; verify manual free and paid flows, Banca ore and the TESTING ribbon in an isolated compose.testing.yaml project, then stop that project.
- [ ] 3.2 Deploy with ./scripts/deploy.sh and verify the deployed release and production mount using read-only checks; record results.
