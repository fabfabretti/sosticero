# Tasks

## 1. Add the routing dependency

- [x] 1.1 Add `react-router` to `frontend/package.json` and install it; verify `npm --prefix frontend run build` still succeeds with the installed version pinned in `package-lock.json`.

## 2. Extend the test harness for routed components

- [x] 2.1 Make the `sidebar.test.cjs` walk invoke function-typed nodes with the existing hook-slot machinery and walk their result; verify the six existing tests still pass with `npm --prefix frontend test`.
- [x] 2.2 Add a pass-through `react-router` mock to the harness (`HashRouter`, `NavLink`, and every export the shell uses); verify a focused test can render a routed child component through the mock.

## 3. App shell and route switch

- [x] 3.1 Add a screen component that reads the current route and defaults an unknown or empty route to Supplenze; verify a test asserts Supplenze is shown at the default route and at an unknown route (spec: Addressable tabs).
- [x] 3.2 Add the top bar with the Sosticero brand and the five tabs, marking the current tab; verify tests assert all five tabs render and that selecting Banca ore shows its screen with its tab current (spec: Persistent bar, Tab navigation).
- [x] 3.3 Wrap the existing substitution screen as the Supplenze tab without changing its behavior; verify the existing test suite still passes unchanged (spec: Supplenze is home).
- [x] 3.4 Add the shell layout so the bar coexists with the sticky sidebar; verify at a short viewport height the sidebar is not clipped and the substitution screen is unchanged (design: shell height).
- [x] 3.5 Let the tab strip scroll horizontally at narrow widths; verify the bar stays on one row and remains usable at a narrow viewport.

## 4. Placeholder screens

- [x] 4.1 Add the Permessi, Banca ore, Stats and Settings placeholder screens; verify a test reaches each by its route and finds its placeholder, and that Supplenze is not a placeholder (spec: Placeholder screens).

## 5. Icon and favicon

- [x] 5.1 Add the inline glasses SVG, using `currentColor`, as the bar's brand mark; verify a test finds it in the bar and that it renders in both light and dark themes.
- [x] 5.2 Add `frontend/public/favicon.svg` and reference it with `<link rel="icon">` in `frontend/index.html`; verify `npm --prefix frontend run build` copies it into the output and the browser tab shows the icon.

## 6. Credits footer

- [x] 6.1 Add the credits footer ("by Fabs 🤝🏻 Big Pickle, 2026") pinned to the bottom of the Settings screen; verify a test asserts it on Settings and absent on the other screens (spec: Credits footer on Settings).

## 7. Integration verification

- [x] 7.1 Run `npm --prefix frontend test` and `npm --prefix frontend run build` together; verify both pass and the substitution screen behaves as before.
- [x] 7.2 Reload on a non-home tab and use browser back/forward; verify the same screen reappears and back/forward move between visited tabs (spec: Addressable tabs).

## Workflow follow-up

- Implement the change with `/opsx-apply` once this plan is approved.
- Archive the change after review and verification pass.
