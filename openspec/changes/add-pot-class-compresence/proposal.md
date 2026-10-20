# Proposal

## Why

Some unavailable POT hours are spent in a class. The office needs to record that class and use the present POT teacher to cover it without treating the assignment as an exceptional release from another commitment.

## What Changes

- Associate one class with an individually disabled POT hour through timetable editing, retaining dated override behavior.
- Offer double-click as a shortcut alongside an explicit keyboard- and touch-accessible class action; show POT and its class together.
- Clear the associated class when the POT hour is reactivated.
- Offer the teacher normally as `Compresenza - POT` for the associated class; preserve unavailable behavior for other classes.
- Automatically release the teacher as A disposizione when the associated class is out.
- Generate a substitution row for an absent class-associated POT teacher only when no other teacher remains in the class.

## Capabilities

### New Capabilities

- `pot-class-associations`: Dated class association and editing lifecycle for individually disabled POT hours.

### Modified Capabilities

- `candidate-selection`: Same-class POT compresence and class-out release override disabled POT unavailability.
- `substitution-rows`: Conditional row generation for absent class-associated POT teachers.

## Impact

Timetable override validation and persistence, teacher timetable editor, candidate eligibility and assignment validation, substitution row generation, timetable presentation and archive round trips. No new external dependency is expected. Operational database records must remain preserved; verification uses isolated temporary databases.
