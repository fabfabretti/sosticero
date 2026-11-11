# Verification

- Backend regression suite: 365 tests passed with isolated temporary databases. The expanded campus-notice suite also passed all 9 tests, covering manual/automatic origins, unknown/same-campus exclusions, group status, no-op saves, content and membership invalidation, stale mutations, authorization and backup validation/round trip.
- Frontend regression suite: all 35 test files passed, including clipboard formatting/failure feedback, grouped preconditions and daily-view integration.
- Production frontend build passed. Existing chunk-size warnings remain.
- OpenSpec strict validation and git diff whitespace checks passed.
- Isolated container project: `sosticero-campus-1794407905`; temporary data mount `/tmp/sosticero-campus.4Wn3ol` to `/data`; automatically allocated localhost port (initially 41091). `/api/environment` returned testing=true before synthetic records were inserted; browser showed the TESTING ribbon.
- Browser scenario: two synthetic cross-campus D assignments at periods 3 and 4. Toggling Comunicato and Accettata updated both rows together; Copy displayed Copiato. Removing period 4 reset both statuses on period 3. Preview saved at `/tmp/sosticero-campus-preview.png`.
- No operational database was used for behavioral checks.

- Final isolated rebuild passed and served `/assets/index-Di3nkmdp.js`; testing mode and temporary mount were rechecked. The test project and its network were stopped and removed; no test app remains running.
- Deployed via `./scripts/deploy.sh`: release `incoming-20261111T144617-128365`, source snapshot `5658e9e9e63210ec64ef48f09216dc39e8493844d3bba18167b192ad2bea31aa`.
- Deployment verified the recovery snapshot, selected image, HTTPS production environment, release marker and frontend. Independent read-only SSH inspection confirmed the running release and authoritative `/home/pietroa/server/fabs/containers/sosticero/data` mount at `/data`.
- No commit created; user approval is still required before committing.

## Date-transition regression fix

The first deployment missed the transition from a loaded campus notice to another date: retained rows/notices were rendered against the newly selected day's missing assignment, causing a TypeError on `.v`. Controls now require the selected date to match the loaded snapshot and an existing D assignment. A regression test reproduces the TypeError with the original render condition and passes with the guard, checking the pending state and next loaded snapshot. All 274 frontend tests pass. A fresh isolated container build passed; the TESTING ribbon, environment endpoint and temporary mount were verified before synthetic data changes. Browser verification moved from 12 October (two notice rows) to 13 October successfully. Screenshot: `/tmp/sosticero-date-change-fixed.png`. The isolated project was stopped and removed before deploying the correction. No commit is authorized.

Correction deployed with `./scripts/deploy.sh` as `incoming-20261111T145536-134078`. Recovery snapshot verified; HTTPS production environment, source marker and frontend checks passed.

## Shared message personalization

User-requested follow-up: all three teacher clipboard templates now receive the assigned teacher's displayed name and the signed-in account's full name. Salutation is `Gentile Professore/Professoressa <nome>,`; recovery and paid messages no longer hardcode a sender. Template/clipboard tests and daily-view prop wiring cover these values. All 275 frontend tests and production builds passed, including the date-transition regression. Fresh isolated Compose project `sosticero-messages-1794411052` used `/tmp/sosticero-messages.vHrDWl`, automatically allocated localhost port 40159, verified testing=true and visible TESTING ribbon, and served the new asset `index-DxLz_bL8.js`. The test project and network were stopped and removed before deployment. No operational records were changed for testing and no commit is authorized.

Personalized templates deployed as `incoming-20261111T153215-141729` using the normal deployment script; recovery snapshot and HTTPS environment/source/frontend checks passed.
