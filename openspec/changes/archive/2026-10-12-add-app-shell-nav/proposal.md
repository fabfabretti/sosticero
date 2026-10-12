# Proposal

## Why

The app is a single screen with no chrome: no header, no way to reach any other
screen, and no identity or credits. New capabilities (banked hours, permissions,
statistics, settings) need a place to live, so the shell has to exist before they
can be built. This also clears the "less AI-generated" presentation item in the
TODO by giving the app a brand and navigation.

## What Changes

- Add a global top bar with the app brand **Sosticero** and a glasses icon, and
  five navigation tabs: **Supplenze** (home, the current screen), **Permessi**,
  **Banca ore**, **Stats**, **Settings**.
- Introduce client-side routing with `react-router` (`HashRouter`), so each tab
  has a URL, survives refresh, and supports browser back/forward.
- Add stub screens for Permessi, Banca ore, Stats and Settings. No feature
  behavior is implemented on them in this change.
- Add a credits footer ("by Fabs 🤝🏻 Big Pickle, 2026") pinned to the bottom of
  the Settings screen.
- Add a glasses app icon as an inline SVG, reused as the favicon.
- Extend the frontend test harness so it can exercise component-based routing
  and the new screens.

## Capabilities

### New Capabilities

- `app-shell`: the persistent application chrome — brand and icon, tab
  navigation between screens, the stub screens reachable from it, and the
  credits footer — and the behavior of each tab's URL.

### Modified Capabilities

_None. Existing candidate-selection and substitution-rows behavior is unchanged;
the substitution screen keeps its current content and behavior as the Supplenze
home tab._

## Impact

- `frontend/src/main.tsx`: add the shell (bar + route switch); move nothing of
  the substitution screen's behavior.
- `frontend/src/style.css`: top-bar, tab and footer styles; shell height must
  account for the existing `100vh` sticky sidebar.
- `frontend/index.html` and a new `frontend/public/favicon.svg`: icon and favicon.
- `frontend/package.json`: new dependency `react-router`.
- `frontend/tests/`: harness extension so routing and stub screens are testable;
  existing tests must keep passing.
- No backend change: `HashRouter` avoids needing an SPA fallback for the
  `StaticFiles` mount.
