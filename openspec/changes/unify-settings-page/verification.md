# Verification

## Automated checks

- Frontend regression suite: all 12 existing test files passed after the redesign.
- Focused import/style tests: receptions, timetable imports and the new Settings inline-style guard passed.
- Final routed UI suite: all 45 tests passed, including group order, native independent disclosures, stable workflow identity through theme changes, JSON restore cancellation, and backup restore confirmation/failure/success paths.
- Frontend production build passed inside the standalone testing container. Existing React Router directive and chunk-size warnings remain.
- `git diff --check` and strict OpenSpec validation passed.

## Browser and container checks

- Test project: `sosticero-settings-1792579772`, using only `/tmp/sosticero-settings.YiqHh9` at `/data` and an automatically allocated localhost port.
- Confirmed `/api/environment` returned `{"testing":true}` before loading a fictional timetable. The browser showed the red TESTING ribbon.
- Verified all five groups start closed and remain independently open together. Keyboard Enter reopened the integration group and retained its unsaved worksheet value. Theme changes also retained the draft and expansion state.
- Reviewed collapsed/open content in dark and light themes at desktop and 390px mobile widths. Mobile document width equalled its client width (375px excluding scrollbar), with no page-wide overflow. Policies exposed all three labelled controls per row and long backup filenames wrapped.
- Browser file upload was denied by the browser permission policy. No retry or workaround upload was attempted. Actual-file preview/collapse verification in the browser remains unperformed; existing automated import tests passed, and native disclosure children remain mounted.
- Screenshots: `/tmp/settings-desktop-dark.png`, `/tmp/settings-desktop-open.png`, `/tmp/settings-mobile-light.png`.
- Final test container rebuild served `index-p5HcGao4.js` and `index-tJGLsw9w.css`, with the isolated mount and testing mode confirmed again. Only this test project was stopped afterward; the temporary browser tab was closed and viewport reset.

## Readability correction

Following user feedback, subsection headings now explicitly use the primary ink color instead of inheriting the global muted h2 color. Shared ordinary-field label styling now covers labels outside main form stacks, with an 8px label gap and 12px field gap. Browser checks in the isolated `sosticero-settings-readability-1792582092` project measured 7.99px actual label separation (8px computed gap) and 14.14:1 heading contrast in dark mode. Light mode uses rgb(22,24,29) headings on white surfaces with the same 8px gap. Both themes were visually reviewed. The inline-style guard passed. Screenshot: `/tmp/settings-readability-dark.png`. The test project was stopped, and normal service was rebuilt and recreated with both required flags.

## Deployment

Rebuilt and recreated normal service with `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate`. After the readability correction, read-only checks confirmed the container is running, `/data` mounts `/home/fabs/Desktop/sosticero/data`, the environment reports `{"testing":false}`, and HTML serves `index-rzueVXyd.js` with `index-OelfAFpl.css`. No operational imports or Settings changes were made. No commit has been created.
