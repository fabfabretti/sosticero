# Design

## Context

See proposal.md for motivation. `style.css` currently owns a small light-default token set with dark overrides. `main.tsx` already sets the root theme attribute from Aspetto. Campus treatments differ between `paid.css`, `permessi.css`, `supplenze.css` and `orari.css`; Banca ore attribution currently lacks a campus-specific class. Recharts is already available. PDF exporters have independent fixed palettes. No backend or data migration is needed.

## Goals / Non-Goals

**Goals:** One source for UI colors and semantic roles, minimal changes to existing selectors, equivalent badge dimensions, and repeatable verification of actual rendered states.

**Non-Goals:** Component extraction, new settings controls, changed theme persistence, typography or radius normalization, redesigned timetable cells, changes to publication/export products, or any operational database edits.

## Decisions

### Centralize exact palette values in `frontend/src/tokens.css`

Load tokens before existing styles. Define dark values on `:root`, explicit light on `:root[data-theme="light"]`, and the same light values under a light preference query scoped to roots without data-theme. Set color-scheme accordingly. This preserves explicit dark while following system preference when unset. Replacing the existing theme toggle with a three-way control was rejected because it changes behavior.

| Token | Dark | Light |
| --- | --- | --- |
| bg | #141412 | #eeede9 |
| surface | #1a1a18 | #fbfaf8 |
| surface-2 | #212120 | #f4f3ef |
| surface-3 | #292927 | #eae9e4 |
| border | #2c2c29 | #dddcd5 |
| border-strong | #403f3b | #c4c3ba |
| text | #e8e6e1 | #1c1c1a |
| text-muted | #9b9a93 | #5d5c56 |
| text-faint | #6c6b65 | #85847d |
| accent | #9bb872 | #4a6a2e |
| accent-hover | #aac581 | #3d5a25 |
| accent-fg | #14190c | #ffffff |
| accent-subtle | rgba(155,184,114,.13) | rgba(74,106,46,.10) |
| accent-border | rgba(155,184,114,.45) | rgba(74,106,46,.40) |
| c | #4fcfa0 | #0f7a57 |
| s | #e8b04a | #946000 |
| warn | #e8b04a | #946000 |
| danger | #ee7b72 | #b3382f |
| info | #84aedb | #2f5f93 |

Each semantic token gets a `-bg` at 13% alpha and `-border` at 40%. Add necessary neutral overlay/backdrop tokens in this file. Transparent and currentColor remain valid color keywords. Existing spacing variables stay where they are. Temporary aliases for `--pan`, `--ink`, `--mute`, `--line`, `--acc`, `--on`, `--soft` can point at new roles to avoid unrelated churn; audit every use of old accent/soft rather than assuming those aliases encode correct semantics.

### Map usages by meaning

Audit CSS, TSX inline values, chart props, SVG colors and color utility classes. Use neutral text for names, links, sorting and passive chips. Use accent only for primary actions, selection and focus; semantic colors for feedback and campus identity. Render chart series through CSS variables; if a chart API requires resolved values, read theme tokens and update on theme changes. Do not snapshot chart colors only at mount. Keep heatmaps and additional series within neutral/accent/info/warn roles without campus-derived categorical colors.

### Share badge styling without changing markup structure

Use shared CSS declarations grouped across existing badge selectors, with campus-specific class hooks on Banca ore attribution. Normalize badge padding and dimensions from the compact Banca ore reference. Preserve each badge's existing font, weight, radius, labels and external placement margins; therefore typography/radius differences may remain and must be reported rather than silently normalized. Full-word labels keep their copy and can naturally be wider than letter badges. Orari's whole lesson cell is not a badge: recolor its semantic roles without resizing the cell or adding wrappers.

Use c/s bg and border tokens for the corresponding campus, with text foreground on filled badges and cells. Rendered verification found the supplied light c/s foregrounds over their own 13% fills yield about 4.3:1; neutral text satisfies the contrast requirement without changing palette values. Keep c/s foreground for standalone markers. Unknown campus remains neutral. A new reusable React component was rejected because component restructuring is outside scope.

### Keep decorations out of layout flow

Draw the active tab's 2px underline without changing box dimensions, for example via background decoration; do not add borders that shift content. Preserve existing active font weight. Use focus-visible outlines for all interactive controls, including dialogs, side panels and custom keyboard targets. Keep existing offsets unless a change is necessary to display the authorized ring.

### Use an explicit exception inventory

Search frontend source for hex, rgb/rgba, hsl/hsla, named colors, utility classes and chart values. Acceptance is no unexplained UI color literals outside tokens, rather than a literal zero-match search. PDF/export colors and necessary fixed output colors are allowed and documented by path and reason. Shared print CSS must preserve readable paper output. Keep the testing ribbon recognizably red through danger semantics.

## Risks / Trade-offs

- Legacy cascading rules override tokens → inspect computed colors in both explicit themes and system fallback, including overlays.
- Subtle text loses contrast over translucent fills → measure composited body-text pairs on all surface roles; reserve faint for disabled/placeholder/icon roles rather than body text.
- Uniform badges still have different fonts/radii → preserve the user's restrictions and list these remaining differences.
- Standalone publication/display builds share frontend assets → run the existing complete build and preserve their presentation where outside this app scope.
- Literal scans miss named colors and aliases → review semantic usages and rendered states, not only regex results.

## Migration Plan

Implement and verify solely against an isolated temporary database using `compose.testing.yaml`, unique exported TEST_PROJECT and TEST_DATA_DIR, and the documented UID/GID command. Inspect allocated port and mount; confirm `/api/environment` reports testing and the red ribbon before data mutations. Capture representative before/after views, exercise both themes on all seven screens and overlays, and check contrast. Stop only this test project afterward.

Deploy verified implementation via `./scripts/deploy.sh` following `docs/server-deployment.md`; verify deployed release identity, served asset hash and production mount using read-only checks. For a faulty release, use the documented rollback procedure; no test database is promoted. This proposal stage performs no deployment. Ask before any commit.
