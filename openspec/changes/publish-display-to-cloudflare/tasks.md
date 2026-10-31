# Tasks

## 1. Shared static display

- [x] 1.1 Add a dedicated static publication entry/build using the existing display renderer; verify both campus links and invalid-campus guidance, and confirm generated assets contain no operational bootstrap or credentials.
- [x] 1.2 Add campus-file transport and cache headers while retaining live transport; test polling, changed/unchanged rotation, stable timestamps, stale failures, visibility return and Rome midnight, including a differently configured device timezone.
- [x] 1.3 Capture only the authenticated account campus in a read transaction, staging centrale.json/succursale.json with separate timestamps and a release manifest; verify fixture tests for empty days, entry/exit notes, multiple replacements and identical live/published content without database mutation, unpublished-other-campus exclusion and never-published sentinels.

## 2. Cloudflare upload and publication lifecycle

- [x] 2.1 Implement a bounded Python Direct Upload adapter against current Cloudflare documentation; test hashing, missing-assets upload, manifest activation, authentication errors and timeouts using mocked HTTP and document the protocol used.
- [x] 2.2 Add durable per-campus committed snapshots, pending candidates and attempt/last-success metadata and process-independent exclusion with background publication/status endpoints; test concurrent requests, interrupted-process reconciliation, uncertain activation, failed uploads and exact public-release verification; verify the other campus’s bytes/timestamp survive publication and restart.
- [x] 2.3 Apply existing session/CSRF rules, account-campus authorization and server Rome-date enforcement; test successful publication by both campuses and rejection of anonymous, cross-campus override, stale-date, missing-configuration and foreign-origin requests cause no upload.
- [x] 2.4 Keep snapshot staging private and disposable; verify cleanup after errors and that no secrets or teacher payloads enter logs, tracked files, source archives or image layers.

## 3. Operational controls and installation

- [x] 3.1 Add top-right today-only Pubblica controls, busy/error status, public links and per-campus last verified timestamp and explicit target-campus label; test day rollover, campus filters independent of account campus, repeated clicks and status recovery after navigation without disturbing unsaved work.
- [x] 3.2 Document and configure server-only Cloudflare credentials without embedding .env.cloudflare in the image; verify sanitized configuration checks, review Compose installation separately where needed, and document token replacement and provider deployment retention/cleanup.
- [x] 3.3 Verify a harmless fixture deployment to the configured Cloudflare project and measure stable-URL propagation/poll latency; inspect cache headers and both-campus refresh without uploading operational teacher data.

## 4. Integration and release

- [x] 4.1 Run appropriate backend/frontend checks and build, then recreate only a unique isolated compose.testing.yaml project with mktemp data; inspect its mount/allocated port, verify testing=true and the red TESTING ribbon before behavioral writes, compare live/static presentation and rotation, and tear down only that project.
- [x] 4.2 Deploy using ./scripts/deploy.sh after server configuration is installed; verify source marker, assets, environment and publication configuration through read-only checks, with no real teacher publication used as a test.
- [x] 4.3 Report verification and any measured provider limits; ask the user whether to commit before making any commit.
- [x] 4.4 Add and verify bottom-right countdown, pause/resume, fade, signature reminder and per-slot assignment types; run display/publication tests and inspect a synthetic multi-page board with class schedule notes in the isolated container.
- [x] 4.5 Deploy the display refinements with ./scripts/deploy.sh and verify production assets and display response read-only; document that hosted snapshots receive the new shell/types on their next explicit publication.
- [x] 4.6 Make cell hierarchy and row heights consistent across both tables, correct replaced-name font inheritance and place the separator above the full lower band; verify display tests and browser geometry at default and supplied screenshot dimensions.
- [x] 4.7 Deploy the uniform grid correction and verify production assets read-only.
- [x] 4.8 Reduce display typography and visual decoration, verify the compact neutral layout with synthetic multi-page data, deploy via ./scripts/deploy.sh and check served assets read-only.
