# Recurring Banca ore declarations

A declaration is identified by `(weekday, teacher ID, hour)`. It recurs weekly;
calendar dates and a teacher's work location are calculated by the report and
are not declaration identity or authorship.

The existing SQLite `state` document stores each declaration and its provenance
in one record, under `paidAvailability[weekday][teacher ID][hour]`:

```json
{"createdBy": "immutable account ID or null", "createdFrom": "centrale"}
```

Weekdays are string keys `0`–`4`, hours are string keys `1`–`7`.
`createdBy` identifies the account; `createdFrom` snapshots its campus when the
entry was added. The C/S label comes from this snapshot, never the teacher's
computed work site. Account renaming or campus changes do not rewrite provenance.

The server sets both fields from the authenticated account. Retaining an hour
preserves its record. Removing it removes the record; adding it again creates a
new record for the current account. There is no separate authorship map to drift
out of sync. This is attribution of current declarations, not a historical audit
log of removed declarations.

Writes retain the existing teacher/day concurrency boundary and SQLite write
transaction: a stale editor cannot overwrite another account's additions. The
report projects records to hour arrays for existing UI consumers; these arrays
are derived, not an additional stored source of truth.

Startup migrates legacy hour arrays to records. As explicitly requested, those
entries receive `createdFrom=centrale` and `createdBy=null`: the real creator is
unknown. The migration changes only legacy arrays, is idempotent, and runs after
the pre-start backup. It never changes teachers, declared hours, timetables or
assignments.

Exports use schema 8 because the stored shape changed. Import accepts older
schemas by migrating their hour arrays before validation. Schema 8 requires
complete provenance records and rejects malformed hours or campus values. JSON
exports and SQLite backups preserve provenance without requiring an account to
exist on the installation where an archive is restored.
