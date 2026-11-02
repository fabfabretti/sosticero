# Tasks

## 1. Theme foundation

- [x] 1.1 Capture baseline views and start a unique isolated `compose.testing.yaml` project with a temporary TEST_DATA_DIR using the required UID/GID build command; verify the mount, allocated localhost port, testing environment response and red ribbon before any data changes.
- [x] 1.2 Add and load `frontend/src/tokens.css` with the exact palette, semantic alpha variants and neutral overlay tokens; verify computed values for explicit dark/light and both system preferences without data-theme.
- [x] 1.3 Consolidate old theme definitions and retain the Aspetto toggle; verify switching theme preserves navigation and draft data, explicit choice overrides system, and unset theme follows live preference changes.
- [x] 1.4 Document token roles and allowed literal exceptions in the existing styling documentation or a focused theme document; verify every documented variable resolves in both themes.

## 2. App color roles and effects

- [x] 2.1 Replace existing UI literals and audit accent/soft usages across app styles, inline TSX, SVG and utilities; verify primary actions use accent-fg and links, names, sort headers and passive chips use neutral roles.
- [x] 2.2 Apply selected/unselected hour-chip treatments and active-nav underline without changing layout; verify computed state colors and unchanged tab box dimensions.
- [x] 2.3 Apply 2px focus-visible rings to all interactive elements and neutralize gradients, glows and colored shadows; verify keyboard traversal through screens, dialogs and side panels.
- [x] 2.4 Map chart series/grid colors to accent/info/warn/border and preserve paper output; verify charts update in both themes and existing export tests pass without PDF palette changes.
- [x] 2.5 Record every retained literal by path and reason in the theme documentation; verify a scan for hex, rgb/rgba, hsl/hsla, named colors and color utilities has no unexplained UI results or old UI accent remnants.

## 3. Campus consistency

- [x] 3.1 Add minimal campus class hooks and shared badge styling across existing selectors; verify equivalent C/S badges share subtle semantic fills/borders and dimensions/padding in Supplenze, Permessi and Banca ore.
- [x] 3.2 Apply campus semantic tokens to Orari markers and cells without resizing lesson cells; verify C/S and unknown identity remain understandable without color and existing labels/accessibility names remain intact.
- [x] 3.3 Document remaining badge font/radius differences required by scope; compare before/after styles to verify no unauthorized typography, radius, margin, copy or structure changes.

## 4. Integration and release

- [x] 4.1 Run the complete frontend build and relevant existing frontend checks; verify both app and standalone build outputs succeed without inspecting minified bundles.
- [x] 4.2 Review all seven screens in dark/light plus dialogs and side panels at desktop and narrow widths; measure actual body-text/background contrast at 4.5:1, including translucent surfaces, and verify layouts and workflows remain intact except authorized badge dimensions/decorations.
- [x] 4.3 Stop only this isolated test project and verify it is stopped; leave the old local operational app stopped and never promote test data.
- [x] 4.4 Deploy with `./scripts/deploy.sh` and perform read-only release, asset and mount checks following server deployment documentation; record the verified release without behavioral production mutations.
- [x] 4.5 Deliver the changed-file list, verification results, color exceptions and deferred non-color differences; ask whether the user wants a commit before committing anything.
