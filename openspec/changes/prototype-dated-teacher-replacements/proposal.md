# Proposal

## Why

Imported teacher names sometimes combine a supplente and an original professor, while the application uses one teacher ID for scheduling and personal recovery debt. Before introducing replacement management, establish whether separate teacher IDs with dated timetable inheritance can preserve existing safeguards without destabilizing the application.

## What Changes

- Build a disposable, developer-only Python prototype using synthetic teachers, timetables and temporary SQLite databases; do not add application routes, UI, startup hooks or migrations.
- Exercise an original teacher, a replacement teacher and the original's return using separate stable person IDs and one dated appointment resolved into an effective timetable.
- Reuse existing domain and recovery functions unchanged to test personal permits, manual balances, fixed RP links, candidate eligibility and absence-derived demand.
- Probe import reconciliation, existing timetable overrides, inbox alias ambiguity, backdated appointment corrections, deletion and serialization/reload using prototype-only adapters.
- Produce an evidence report recording passing cases, failing assumptions, production integration points and a go/no-go recommendation. Success authorizes no rollout or production feature implementation.

## Capabilities

### New Capabilities

None. This is an isolated research harness, not a new application capability. `skip_specs: true` deliberately avoids specifying an unproven feature as durable application behavior.

### Modified Capabilities

None. Existing permessi, inbox, candidate selection, archives and timetable behavior remain unchanged. Their invariants are evaluation criteria rather than modified requirements.

## Impact

Future implementation is limited to a self-contained directory such as `experiments/teacher_replacements/`, containing the prototype, synthetic fixtures, checks, usage instructions and findings. Read existing `backend/timetables.py`, `backend/overrides.py`, `backend/domain.py`, `backend/recovery.py`, `backend/inbox.py` and archive/API consumers to ground the assessment; do not modify them. No new dependencies, operational database access, live inbox connection, frontend build, container restart or deployment is required. Existing uncommitted application work must remain untouched.
