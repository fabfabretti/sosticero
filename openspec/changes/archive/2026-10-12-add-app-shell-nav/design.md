# Design

## Context

See proposal.md for motivation. Current state that shapes the approach:

- `frontend/src/main.tsx` is a single `App` that renders `<aside>` + `<main>`
  directly; there is no routing and no chrome. The substitution screen's JSX is
  produced inside `App`'s own body.
- `backend/main.py` mounts the built frontend with
  `StaticFiles(directory=static, html=True)` at `/` with no catch-all, so a
  browser refresh on a path route such as `/settings` returns 404.
- `frontend/tests/sidebar.test.cjs` does not render React. It calls `App()` once
  and walks the returned JSX objects, finding nodes by `className` and by
  component reference. Nested function components are never invoked, so any JSX
  a child component would produce is invisible to it.
- `aside` is `position: sticky; top: 0; height: 100vh`, and `.app` is a
  `min-height: 100vh` grid; the bar's height has to be accounted for.
- Installed React is 19.3.0 on Node 24; `react-router@8` needs React >=19.2.7.

## Goals / Non-Goals

**Goals:**
- Shell, tabs and routes that survive refresh and browser back/forward.
- A path from tab state to screens that keeps the existing substitution screen
  byte-for-byte in behavior.
- A test harness that can see routed components, so stub screens are testable.

**Non-Goals:**
- Implementing any of Permessi, Banca ore, Stats or Settings.
- Moving dataset upload or the theme toggle into Settings (future work).
- Mobile layout work beyond horizontal scrolling of the tab strip.

## Decisions

**react-router with `HashRouter`, not `BrowserRouter`.** `BrowserRouter` would
make a refresh on any non-home tab 404 against the `StaticFiles` mount, forcing
a `backend/main.py` catch-all in this change. `HashRouter` gets the same router
machinery with no backend change. The URL-shape cost (`/#/settings`) is
acceptable for an unauthenticated LAN tool; migrating to path URLs later is
swapping the router component plus adding a catch-all. Alternative considered:
a ~10-line hand-rolled `hash -> view` hook with no dependency; rejected because
the deliberate choice was to own no router logic and take the maintained library.

**Keep the route switch inside a body that yields inline JSX.** The router
provider wraps a screen component that calls `useLocation()` and returns each
screen's JSX directly, instead of delegating the current screen to
`<Routes><Route element={...}/></Routes>`. This is what lets the harness see the
substitution screen's nodes without reimplementing React rendering. `Routes`
is not used for the five tabs.

**Extend the harness to descend into components (preferred), rather than
pointing it at a hidden component.** The mock `react-router` exports
pass-through function components (`HashRouter`, `NavLink`, etc.), and the walk
invokes function-typed nodes and walks their result. This makes the harness
survive future restructuring and is the only way stub-screen tests can assert
anything. Alternative considered: have the harness import the inner screen
component directly — smaller now, but brittle and leaves stubs untestable.

**Shell height via a flex column, not magic numbers.** Wrap the chrome in
`.shell { display:flex; flex-direction:column; min-height:100vh }`, make the
existing grid `flex:1`, and let the sticky sidebar use `calc(100dvh - <bar>)`
or `height:100%` of the flex child. Avoids hardcoding a pixel bar height that
breaks with wrapping fonts.

**Icon: one inline SVG using `currentColor`, reused as favicon.** The bar
embeds the SVG inline so it themes with the existing CSS variables; the same
mark is written to `frontend/public/favicon.svg` and referenced by
`<link rel="icon">` in `index.html`. Vite serves `public/` at the root
unmodified (`vite.config.ts` does not override `publicDir`).

**Credits footer pinned to the viewport bottom of Settings.** The Settings
stub area flexes to fill the screen and the footer sits after it, so on short
content the credits are at the bottom edge rather than floating mid-screen.

## Risks / Trade-offs

- [The harness extension turns the walk into a mini renderer; hooks in
  components it descends into need the existing slot machinery to be applied at
  the right cursor] → Keep descended components hook-light, and cover the
  descent itself with a test before adding stub-screen assertions.
- [`react-router@8` is a recent major with a `react >=19.2.7` peer] → The lock
  already has React 19.3.0; pin the router version and run
  `npm --prefix frontend run build` plus the test suite after install.
- [Bar height interacts with the existing `100vh` sidebar and safe-area
  padding; a wrong calculation can clip the sidebar on short viewports] → Use
  the flex shell; verify the supplenze screen at a short viewport height is
  unchanged, and add a task to check it visually.
- [`StaticFiles(html=True)` still has no catch-all] → Not a problem for hash
  routes; recorded so a later switch to path URLs remembers the backend change.

## Migration Plan

Additive: new dependency, new files, and a wrapper around existing content. No
data migration. Rollback is removing the shell and the `react-router`
dependency; the substitution screen is otherwise untouched.
