# Banca ore

Banca ore records recurring Monday–Friday paid availability for periods 1–7. Use **Modifica disponibilità**, select a teacher and weekday, choose periods and save. Clear all periods to remove that teacher's declaration for the weekday. The reference week controls computed campus labels using each date's effective timetable; it does not limit declarations to that week.

Campus feasibility follows permit-recovery travel checks at both sides of the slot, with breaks between periods 2–3 and 4–5. No commitments means either campus. Unknown campuses display **Sede da verificare** and remain selectable; known impossible transfers and occupied slots do not authorize paid assignments. Daily absences and existing assignments are checked when assigning.

In Supplenze, choose **Disponibile a pagamento** to record paid work. A teacher can appear separately under permit recovery; the clicked category determines accounting. Paid candidates are ordered by ascending paid assignments, including future bookings. Every saved paid assignment counts once immediately across all current data; replacing or removing it adjusts totals. Removing availability does not remove saved work. Review flags retain paid accounting until explicit correction.

The Banca ore register shows each paid substitution, the assigning campus account, notification status and per-teacher totals. **Avvisato** and the copy-request button exist only in the **Supplenze table**, following permit-recovery actions. Each copied email asks the teacher to attend one specific paid substitution. Copying neither sends email nor changes Avvisato; notification does not affect accounting.

Stats **Reperibili + Pagamento** unions ordinary availability, favourable permit recovery and paid opportunities, deduplicating teachers per cell and across campuses. Like existing Stats availability, this is theoretical timetable capacity: it does not subtract daily absences or bookings. Unknown paid-campus feasibility is disclosed. The POT ratio is unchanged.

## Data and compatibility

Operational state adds `paidAvailability`, keyed by weekday (`0`–`4`), then teacher ID, with distinct periods (`1`–`7`). Assignments use category `PAID`, server-written `assignedBy` (campus account), `notified` and `paidContext` (`site`, `room`, `class`). The paid register and totals derive from assignments, not a separate ledger. Backup and validated archive exports preserve these fields; legacy archives omit them and receive empty declarations. Older application releases are not suitable for restoring paid data; rollback requires a compatible release or an appropriate pre-release snapshot.

Both accounts can edit shared declarations. Assignment and Avvisato writes require ownership of the substitution row's campus and current record preconditions. Concurrent edits reject stale values; use **Ricarica valori salvati** to reconcile a declaration conflict. There is no payroll/rate calculation, school-year partitioning or performed/completed workflow.
