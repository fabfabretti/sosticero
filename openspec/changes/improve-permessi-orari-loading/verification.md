# Loading verification

## Fixture and baseline

All measurements use disposable synthetic data: 180 teachers, 35 weekly slots each (6,300 lessons), 21 imported timetable versions and 600 permits on 40 dates. No production data is used. The baseline generator and measurement script are retained for this run at `/tmp/sosticero-loading-work/measure.py`; data is under that temporary directory and the isolated Compose mount is `/tmp/sosticero-loading-test.6FTaRQ`.

The preparation benchmark calls the actual GET route directly against its temporary SQLite database four times and reports the median. Serialization uses compact UTF-8 JSON and gzip defaults; these byte counts exclude HTTP framing. Baseline: Permessi preparation 1,021.67 ms, serialization 385.99 ms, 17,352,121 bytes plain / 545,487 gzip. Orari preparation 1,315.27 ms, serialization 44.89 ms, 1,567,195 bytes plain / 47,000 gzip.

Browser baseline: production container build, Codex in-app browser, default desktop viewport, isolated test account. A temporary localhost proxy injects a MutationObserver and long-task observer into the HTML before the app script. On an authenticated full reload, all 180 Orari cards first appear together at 3,173.9 ms after instrumentation starts; a main-thread task starting at 2,734.4 ms lasts 819 ms. These values include local API/network startup and are illustrative single-run measurements, not production latency or a statistical browser benchmark.

The container's inspected mount is the unique temporary testing directory and its allocated port is 35853; `/api/environment` returns testing=true and the browser visibly shows TESTING. The environment curl initially failed under sandbox socket restrictions; fixture seeding proceeded before that check succeeded. This ordering mistake was caught, and the subsequent privileged read-only check confirmed testing=true before further behavioral work. No operational data or operational Compose service was touched.

## After changes

First compact-response measurement on the same fixture: Permessi preparation 1,088.42 ms, serialization 47.26 ms, 1,052,691 bytes plain / 88,852 gzip. Payload reduction is 93.9% plain and 83.7% gzip; serialization is 87.8% faster. Preparation is approximately unchanged (6.5% slower in this small run), and historical resolution remains a cost. This is not evidence of faster server preparation. All non-timetable response fields compare identical, including metadata, balances, recovery summaries and concurrency tokens.

Progressive rendering unit checks use controlled scheduling and verify six initial cards, automatic completion, complete search/PDF before completion, retained draft and visible prefix, cancellation on filter/date/unmount. Production TypeScript/Vite build passes. Final integrated measurements and suite results follow.

## Regression results

All 357 backend tests pass (268.8 seconds), including the three new compact-context checks. All 34 frontend test files pass after the final batching refactor (109.6 seconds). Existing compiler/bundle-size and Python deprecation/resource warnings remain non-fatal. A sandboxed TestClient run stalled and was stopped; the complete successful backend run used the normal host environment with temporary test databases.

The pre-existing PaidHours source/CSS/test modifications match the already deployed release `incoming-20261107T112635-68773` byte-for-byte by SHA-256; retaining them in this deployment preserves the existing release rather than introducing unrelated edits.

## Integrated browser checks

Final batching architecture measurement on a fresh authenticated reload of `index-DbP3j1nh.js`, at the original default browser viewport: first 6 cards at 4,487.7 ms; all 180 at 10,882.5 ms, with automatic intermediate batches. Largest observed task through completion was 385 ms versus the baseline's 819 ms. The progressive list takes longer to finish and first-content latency did not improve in these single runs; server/network/startup variance and initial data preparation remain. The measured improvement is reduced single-task blocking with earlier usable content relative to completion, not a demonstrated reduction in end-to-end latency. A first trial that rerendered the parent per batch was replaced with child-local progress so unchanged card elements are reused.

At 1280x900, opening Teacher 000's name editor during rendering and entering a draft at 36 cards retained the draft, focused input, exact scroll offset (108.889 px) and first-card top (243.275 px) at 180 cards. Search found Teacher 179 independently of initial mounting. Full PDF projection during partial rendering is covered by the new component test and existing PDF suite. A final scope-reset regression ensures clearing a filter after full rendering starts a new progressive prefix.

Permessi was checked in light/dark views and desktop/mobile layouts. A synthetic permit for Teacher 179 on 12/10/2026 saved successfully; the form showed the expected maximum of 3 for 7 scheduled hours, and the register showed both weekly sites, the author, one owed hour and the existing two-month deadline. Mobile 390x844 and desktop 1280x900 checks retain existing controls and table behavior. No test permit was created outside the isolated database.

Final scope-reset build: container image `9f91194629455229dc890bd1a9e0cb0eda34522ce221b8427c34ba8cf9651322`, served `index-WRC_OP-q.js` on allocated localhost port 43717 with the same isolated mount and testing=true. Focused progressive and existing Orari tests pass after the final guard. Direct browser verification found Teacher 179 alone, clearing search immediately exposed 6 cards plus the end loader, and the list automatically reached 180 with no loader. The temporary timing proxy was stopped and the browser viewport override reset; the test tab was closed.

The unique isolated testing Compose project was stopped with its explicit project name; the filtered running-container check returned no containers. The old local operational app remained stopped.

## Deployment

Deployed with `./scripts/deploy.sh` as `incoming-20261107T121712-94429`. Source snapshot: `dab2b1f0edc8021e347695b8e9cd9c70f510e46a46108f3425174d978c990101`; image: `sha256:db197ca9a723aa4c5fee9da77a32e4aae5aafc5e898495fbee5dd1eb0351dc66`. The script verified the complete recovery snapshot, replacement image, production mount and HTTPS release. Independent read-only SSH inspection confirmed the exact deployed source marker and `/home/pietroa/server/fabs/containers/sosticero/data` mount. Independent HTTPS checks confirmed testing=false, the exact source marker and served assets `index-CAkx-ubN.js` / `index-DyX3Jz7h.css`. No production behavioral writes or test-data transfers were used.

SSH used the graphical askpass helper and a reusable control connection. Temporary SSH/SCP wrappers selected an empty client config to avoid the host's unreadable system SSH config; no SSH config was edited. No code was committed.

## Follow-up: initial-load correction

The user reported no perceptible speedup. Read-only server checks confirmed the first release and its progressive code were live. Unprofiled production calculations on read-only-loaded data took about 1,002 ms for compact permit history and 54 ms for the current Orari dataset. Profiling showed repeated deep copies in staffing resolution; the original synthetic fixture had an empty staffing document and missed that path. No claim of production speed improvement follows from the first payload reduction.

A new consistent copy was made with SQLite's online backup API inside a new server `/tmp` directory and streamed into a new isolated local directory, without copying a live database file or production identities. Complete local TestClient request baselines (four runs, median): Permessi 1,934.15 ms / 550,750 bytes; Orari 730.66 ms / 784,635 bytes. After removing duplicate copying and generic response conversion: Permessi 883.91 ms, Orari 361.84 ms. Both complete JSON bodies compare identical before/after; decoded byte counts are unchanged. These are local API measurements on representative data, not WAN or production response-time guarantees.

Representative browser baseline (first deployed implementation, same in-app browser, unchanged default viewport, temporary local instrumentation proxy): 157 eligible teacher cards; API response completed at 2,948.4 ms, first six cards at 3,205.3 ms, complete list at 11,400.7 ms. API resource duration was 1,536.3 ms; card readiness followed response completion by 256.9 ms. Browser values include scheduling and other local work and are single-run observations.

Corrected representative browser run (`index-eotSsKvj.js`): API completion 985.6 ms, first six cards 1,063.3 ms, complete 157-card list 4,680.0 ms. Card readiness followed API completion by 77.7 ms versus 256.9 ms before; the initial API resource duration was 572.7 ms versus 1,536.3 ms before. These are single-run local browser observations; the stronger repeated measurement is the four-run median full API time reported above. The end loader remained until automatic completion.

The corrected browser check retained an unsaved name draft, focused input, scroll offset (590.222 px) and editor top (215.944 px) while visible cards grew from 36 to 157. After cancelling the draft, searching the last teacher produced exactly one grid. Permessi displayed the register and manual balances with no alert errors. A new resolver test checks source/document isolation and independently copied excluded POT data; the focused backend checks pass (21 tests), and the complete frontend suite passes (34 files).

Correction regression/release: all 358 backend tests pass (193.8 seconds), all 34 frontend test files pass, and the production container build passes. The isolated Compose project and timing proxy were stopped, the browser tab closed, and the task-owned operational database copies and raw before/after JSON bodies removed after comparison. The temporary server online-backup file was removed as well. No copied data was returned to production.

Deployed with `./scripts/deploy.sh` as `incoming-20261107T124054-110953`; source `0649ad853a50920ef6b0a9969f15f2347ebb52c099a1e2b517c1b177a455bcf2`; image `sha256:4960d5b3203404d033b717170e2e5e81ceba31dfd40d61b171577f2a361901e3`. The deployment verified its complete recovery snapshot and replacement service. Independent HTTPS checks confirmed testing=false, the exact source and served `index-BcyRlkOe.js` / `index-DyX3Jz7h.css`; independent SSH checks confirmed the marker and unchanged production data mount.

Post-deployment pure-function checks against read-only-loaded production data: historical permit projection runs 1,461 / 598 / 579 ms (median 598, compared with 1,002 ms previously); current Orari dataset 45 / 32 / 30 ms (median 32, compared with 54 previously). These calculation checks do not measure full production HTTP/browser latency and the first run shows startup variance. Existing tabs retain old JavaScript until reloaded; the existing build notice offers Ricarica rather than forcibly discarding edits. No commit was made.

## Navigation cache follow-up — 2026-11-07

Implemented endpoint/date-scoped session-memory snapshots for Supplenze, Permessi and Orari. Cached data is applied before paint; receipt timestamps govern freshness across navigation. Requests older than 15 seconds revalidate quietly and ongoing polling retains draft deferral and scroll restoration. Successful writes clear all page caches; session changes and replacement-generation changes also clear them. Pending reads and deferred snapshots cannot repopulate an invalidated cache. Cache size is bounded to 30 endpoint/date snapshots; no browser persistence, backend revision protocol or new dependency.

Validation:
- Frontend suite: all 34 test files pass, including focused tests for immediate reuse, absolute freshness across remounts, stale failure/retry, draft deferral, invalidated pending snapshots, shared reads and session/write invalidation. Production build passes; existing bundle-size warning remains.
- Standalone isolated project `sosticero-cache-1794087490`, mount `/tmp/sosticero-cache-data.YdPYmt`, allocated port 46355. Mount and `testing=true` checked before synthetic fixture/account creation; red TESTING ribbon observed. No operational data used or changed.
- Temporary localhost proxy delayed each of the three GET endpoints by 2 seconds. Browser DOM observation measured first Permessi/Orari visits at 2085/2058 ms; cached return visits at Permessi 58 ms, Supplenze 46 ms, Orari 29 ms. Supplenze remained usable while its stale read was pending. A later stale Orari return displayed usable grids/edit controls in 43 ms with its fresh response still pending and no foreground loader. Single runs on a small synthetic fixture, demonstrating network independence rather than production timing promises.
- Saved a synthetic teacher name through Orari. Subsequent Permessi navigation had no cached snapshot and waited for a new response, confirming cross-page write invalidation. Browser console had no errors/warnings.
- Temporary browser tab and proxy closed; isolated Compose project stopped after checks.

Limits: first uncached visits and browser reloads still need the network; cache reuses responses, not mounted DOM. External edits can remain unseen until the next successful poll, and active drafts deliberately retain their displayed baseline. Existing optimistic save checks still reject conflicting changes. No production record writes are part of release verification.

Released with `./scripts/deploy.sh` as `incoming-20261107T214352-160099`. Independent HTTPS checks matched local source `9af05ef30d283dbbce5af3dc2d7445325b17c575397597b8e3a6f21985e2e762`, `testing=false`, and assets `index-cMsQYAXS.js` / `index-DyX3Jz7h.css`. Independent SSH inspection confirmed image `sha256:d0bd587d49958fbc1c18f5b16695d5543a93997a728667c70fff598f891902c2` and unchanged production `/data` mount. Existing open tabs need one reload to receive the new JavaScript. Changes remain uncommitted pending user confirmation.

## Banca ore / Statistics cache extension — 2026-11-07

Opted Banca ore, the statistics report and its A disposizione report into the same cache. Keys include all effective selection parameters, with today's date included for relative statistics periods. Valid statistics selections now refresh quietly after 15 seconds; invalid ranges retain validation feedback. Explicit retries and post-save refreshes still force reads. Shared session/write invalidation and Banca ore editing protection are unchanged.

All 34 frontend test files pass, including new real-hook tests for cached campus/date selection and report readiness. Production build passes. Browser verification used isolated project `sosticero-cache-extra-1794088977`, mount `/tmp/sosticero-cache-extra-data.zVyd1j`, port 40757, synthetic records only; testing=true and the TESTING ribbon were confirmed. With 2-second artificial endpoint delays, first visits took Banca ore 2136 ms / Statistics 2156 ms; cached return visits took 77 ms / 164 ms and showed usable content without a foreground loader. The A disposizione report also remained present and unblocked after leaving and returning. These are single local synthetic runs, not production latency measurements. No browser runtime errors were observed. Test tab, proxy and isolated Compose project were stopped afterward.

Extension deployed with `./scripts/deploy.sh` as `incoming-20261107T220748-167315`. Independent HTTPS verification matched current source `f11b30e920ec9c4f5d7619267c8f85499c2a2298b058282e5e2fc8f232fdb3b0`, `testing=false` and served `index-B4bt7BPT.js` / `index-DyX3Jz7h.css`. SSH inspection confirmed image `sha256:915460bb5d39ba12ea1747c4246df5afc605ec9636f5251afaf9c607692f664f` and the unchanged authoritative data mount. First uncached selections still need a request; existing browser tabs need a reload. All caching changes remain uncommitted pending confirmation.
