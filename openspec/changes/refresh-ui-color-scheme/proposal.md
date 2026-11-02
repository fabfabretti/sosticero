# Proposal

## Why

The app mixes accent and campus colors across screens, making the same C/S badge appear quiet in Banca ore and conspicuous in Permessi. A shared warm-neutral palette and subtle campus treatment will make both themes coherent without redesigning the interface.

## What Changes

- Centralize the supplied dark/light palette in one CSS token file, with system preference fallback and the existing Aspetto override.
- Map colors by purpose: reserve the green accent for primary actions, selection and focus; use neutral text for links, names and sorting.
- Standardize campus badge colors and dimensions around Banca ore's subtle treatment, retaining letters and existing labels.
- Apply the specified hour-selection colors, transparent active navigation with a 2px accent underline, and 2px focus rings.
- Tokenize charts and neutral overlay shadows; remove hue gradients, glows and colored shadows.
- Preserve layout, typography, copy, icons, component structure and behavior. The only non-color exceptions are campus badge dimensions/padding and the requested underline/focus decoration.
- Permit documented hard-coded colors where necessary; preserve PDF/export palettes.

## Capabilities

### New Capabilities

- `ui-theme`: App-wide theme resolution, semantic color roles, campus badge consistency and accessible color states.

### Modified Capabilities

None. Existing app-shell navigation and settings workflows remain intact; the new capability supplies their shared visual contract.

## Impact

Frontend CSS, theme application in `main.tsx`, campus badge class hooks in relevant TSX files, and chart rendering. No API, database or dependency changes are planned. Verification covers all seven app screens, dialogs and side panels in both themes using an isolated testing project. Once implemented and verified, deploy through `./scripts/deploy.sh` and perform read-only release checks. Commit only after asking the user.
