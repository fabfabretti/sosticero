# Tasks

## 1. Isolated harness and baseline

- [ ] 1.1 Create the self-contained `experiments/teacher_replacements/` harness, synthetic fixtures and documented run command; verify all runtime databases/backups are temporary, no operational path is accepted, and no production module imports the experiment.
- [ ] 1.2 Add baseline comparisons using the existing timetable, domain and recovery functions; verify no-appointment inputs match existing datasets, demand, candidate results and ledger output, and document which production functions are reused unchanged.

## 2. Dated schedule inheritance

- [ ] 2.1 Implement prototype-only people, source mappings, appointments and a copied effective-dataset resolver; verify before/start/end/after dates, open-ended appointments, metadata preservation and one active schedule owner without mutating imports or state.
- [ ] 2.2 Add input rejection for invalid dates/references, person/source ID collisions, overlapping appointments, replacement chains and independently scheduled replacement conflicts; verify failures leave all inputs unchanged and document the experiment's restrictions.
- [ ] 2.3 Exercise compatible timetable imports and existing special-hour overrides through the resolver; verify changed lessons follow the active owner, suspended patch groups stay suspended, missing/changed source identity requires review, and unrelated teachers/dates are unchanged.

## 3. Personal accounting and historical corrections

- [ ] 3.1 Exercise permits and separate manual balances for both people with unchanged recovery/domain functions; verify correct candidate and RP behavior, wrong-person link rejection, fixed permit links, deadline boundaries, future reservations, renaming and return to the original teacher.
- [ ] 3.2 Exercise replacement absences alongside the original's long absence; verify class demand appears once, replacement absence excludes that person from assignment, and original absence hours are not transferred to the replacement.
- [ ] 3.3 Add prototype appointment-impact checks; verify conflicting backdates, shortening and deletion reject without changing saved records, unused appointments can be deleted, and a later appointment reusing the same person retains that person's balance. Document any failure of unchanged domain functions rather than bypassing it.

## 4. Inbox and persistence probes

- [ ] 4.1 Add offline alias-resolution scenarios; verify unique replacement names, ambiguous original-name submissions, duplicate aliases, boundary-spanning ranges and accepted-item identity preservation. Document simulated behavior separately from live Inbox guarantees.
- [ ] 4.2 Add experimental-envelope validation and temporary SQLite/JSON round trips plus SQLite online backup; verify identities, notes/attachments references, permit links and balances survive reload, and invalid references or late failures leave stored documents unchanged. Label this format as incompatible with application archives unless separately demonstrated.

## 5. Evidence and decision

- [ ] 5.1 Run the complete documented experiment and relevant existing recovery/timetable checks on isolated synthetic databases; deliver scenario results and exact unchanged-state comparisons, preserving failures and reporting cleanup success.
- [ ] 5.2 Deliver a findings report with concrete integration gaps in entries, Inbox, reference checks, permit history, archive validation, statistics, exports and UI; verify every claimed guarantee identifies whether it came from an unchanged production function, a prototype adapter, source inspection or remains untested.
- [ ] 5.3 Recommend reject, revise or separately propose production integration; verify the report explains unresolved imported-ID ownership and metadata assumptions, lists required future changes, and that this change modifies no application source, operational data, service configuration or running deployment.

## Workflow follow-up

- Review the experiment's findings before deciding whether to propose an application feature. Completing this change does not authorize adoption or deployment.
- Ask the user whether to commit before making any commit.
