# Verification

## Local checks — 2026-11-16

- Frontend: all 35 test files passed; TypeScript, main Vite build and publication build passed. One existing test was updated to account for the new action; new component and daily-table tests cover permissions, payloads and persistent notes.
- Backend: new refusal API tests cover release, RP availability, paid records/budget use, pending statistics, intentional reassignment, deduplication, restart, disappearing rows, archives, malformed imports, stale replacements, grouped changes and transaction rollback. All 403 discovered test invocations were covered by passing runs: the long run was terminated before completion, then all 34 remaining/rechecked cases passed. An obsolete unsupported-schema fixture was updated from 12 to 13. Focused accounting and group-preservation rechecks also passed.
- Isolated project: `sosticero-refusals-1794849795`, temporary mount `/tmp/sosticero-refusals.EQuISQ` at `/data`. Final rebuilt container used localhost port 36333; inspected main.py/concurrency.py hashes matched the working source. `/api/environment` returned `{"testing":true}` and the browser showed the red TESTING ribbon before data changes.
- Synthetic browser checks: refused RP, paid and a two-hour cross-campus group; all affected rows released, history appeared on every row. Assigned a different professor to the first row and reloaded: the previous professor's note remained. Desktop and 390px screenshots inspected; notes wrap and remain readable. Public display code does not render this internal state field.
- Stopped only this testing project with standalone compose.testing.yaml. Operational local Compose was not started; no test records or settings were written to production.
- Strict OpenSpec validation and git diff whitespace checks passed.

## Deployment — 2026-11-16

Deployed through `./scripts/deploy.sh` as `incoming-20261116T173215-30034`.
Source snapshot: `bd39cf1da4dd1fffefc708d236a9ec82d678eea5b6d520e20b4ffe9360706422`.
The script created a complete recovery snapshot at
`/home/pietroa/server/fabs/containers/sosticero/snapshots/incoming-20261116T173215-30034`.
Independent read-only checks confirmed testing=false, the exact HTTPS source marker,
served assets `index-APuS3oZc.js` / `index-CSiDBJB5.css`, running image
`sha256:b43ce9fabc8f2e6ba3afcec40fe59501058382516a1236e6eafdd208fc6696f2`
and the authoritative mount `/home/pietroa/server/fabs/containers/sosticero/data`.
No production behavioral writes were used. No commit was made.
