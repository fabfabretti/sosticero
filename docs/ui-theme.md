# UI colors

`frontend/src/tokens.css` is the source of app color values. Dark is the root fallback; explicit `data-theme="light"` selects light. With no attribute, the light system preference overrides the fallback. Impostazioni > Aspetto continues to set the root attribute; no persistence or controls were added.

Use `--bg` for the app, `--surface` for panels, `--surface-2` for inputs and hover, `--surface-3` for neutral pressed states, `--border` for hairlines and `--border-strong` for inputs. Text uses `--text`, `--text-muted`, or `--text-faint` (disabled, placeholder and decorative icon roles only). Legacy `pan/ink/mute/line/acc/on/soft` variables alias these roles; `soft` is neutral, not selected.

Use `--accent` only for primary controls, selection and focus, with `--accent-fg` on solid accent. Hour selection uses `--accent-subtle`, `--accent-border` and `--text`. Campus C/S uses `--c` / `--s` and their 13% fill and 40% border variants. Filled badges and lesson cells use `--text` foreground: the light semantic foregrounds over their own fills measure about 4.3:1, below the required 4.5:1. Feedback uses `warn/danger/info` variants. Charts use accent, info, warn in order; campus tokens are never chart series roles. Neutral overlay shadows and backdrops also live in tokens.

## Intentional exceptions

- `frontend/src/substitutionPdf.ts` and `frontend/src/timetablePdf.ts`: fixed document palettes are preserved; PDF APIs expect numeric colors and exported paper output must stay independent of the user's screen theme.
- Paper colors are centralized as `--paper*` tokens and applied by existing print/preview rules. The historic paper accent is retained for paper output only.
- `--testing-bg` / `--testing-fg` keep the testing ribbon red with readable white text in either theme.
- `transparent`, `currentColor`, inherited colors, CSS color mixing, and alpha/opacity values are not independent palette literals.
- The standalone published display keeps its existing selectors and layout; its shared stylesheet loads the token definitions too.

## Scope limits

Campus badges share a 20px minimum width, 22px height and 0 4px padding; full-word labels naturally need additional width. Existing badge fonts, weights, radii and placement margins remain unchanged, so they can still differ in those respects. Orari lesson cells retain their dimensions and inline campus letters. No component wrappers, copy, icons or interactions were changed. The nav underline and focus outlines do not affect element box dimensions.

## Verification

Review the seven app screens, dialogs and drawers in both themes, plus system fallback and keyboard focus. Measure rendered body-text contrast against composited backgrounds at 4.5:1. Scan frontend source for hex, RGB/HSL functions, named colors, color utilities and chart defaults; every retained literal outside tokens must have an explanation above. PDF exporters are excluded from the UI palette scan.

## Applied release and checks

Deployed to atlante as `incoming-20261102T073316-128644`, snapshot `bb15e64e7e172097ab224b2add0ebf14ae11d51810375fe56077e19f96660c5c`. Deployment verified the production environment, release marker and frontend; independent read-only HTTPS checks also verified both served assets. The isolated testing project was stopped.

Both builds succeeded. Twenty-six existing frontend test files passed. The sidebar harness reproduced exactly the same 21 failing cases against unchanged main.tsx (43/64 passed in both runs); these pre-existing failures were left outside the color change. No backend logic changed.

Reviewed all seven screens in dark/light and at desktop/phone widths, plus the availability modal and candidate drawer. Rendered text measurements passed 4.5:1 after neutralizing filled campus-label text; minimum sampled light chart/timetable text was 4.55:1. Explicit light overrides system dark; system light uses declarations identical to explicit light (checked statically). Navigation boxes matched their baseline dimensions. No unexplained hex/RGB/HSL literals remain in app source outside tokens and the two PDF exporters.

Changed application files:

- `frontend/src/tokens.css`
- `frontend/src/style.css`
- `frontend/src/ui.css`
- `frontend/src/supplenze.css`
- `frontend/src/orari.css`
- `frontend/src/paid.css`
- `frontend/src/inbox.css`
- `frontend/src/main.tsx`
- `frontend/src/publicDisplay.tsx`
- `frontend/src/PaidHours.tsx`
- `frontend/src/Stats.tsx`

Documentation/planning: this file and `openspec/changes/refresh-ui-color-scheme/` (`.openspec.yaml`, proposal, design, ui-theme spec and tasks). No commit was made.
