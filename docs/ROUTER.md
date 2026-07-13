# Router & Navigation Setup

How routing, page transitions, and the native-feeling navigation work in this app.
The stack is **React Router (react-router-dom v6) + framer-motion** — no Framework7,
no extra navigation library.

---

## 1. Folder-driven routes — `src/lib/pageRoutes.js`

Every `.jsx` file in `src/pages/` (subfolders included) automatically becomes a route
via Vite's `import.meta.glob`. **Adding a page never requires touching the router.**

| File | URL |
|---|---|
| `src/pages/Settings.jsx` | `/settings` |
| `src/pages/admin/Reports.jsx` | `/admin/reports` |
| `src/pages/MyThing.jsx` | `/my-thing` (kebab-case) |

Custom URLs are declared in `PATH_OVERRIDES` (see below), e.g. `Home → /`.

## 2. Navigation config — `src/config/navigation.js`

The ONE file to touch for menu / access / URL decisions:

- **`TABS`** — the bottom menu-bar pages (path, title, icon). Tab pages get the
  persistent floating header + tab bar chrome and are excluded from swipe-back.
- **`PUBLIC_PATHS`** — routes reachable while signed out. Everything else is wrapped
  in `ProtectedRoute` and redirects to `/login`.
- **`PATH_OVERRIDES`** — filename → custom URL (e.g. `Home: '/'`, `EmailLogin: '/login/email'`).
- **`ALIASES`** — extra URLs rendering an existing page (e.g. `/oauth/auth` → `/auth`,
  required by the native OAuth deep link).

## 3. Animated route transitions — `src/components/AnimatedRoutes.jsx`

Replaces a plain `<Routes>` with direction-aware, iOS-style transitions:

| Direction | When | Animation |
|---|---|---|
| `push` | forward navigation | new page slides in from the right ON TOP; old page parallax-drifts to −30% and dims (UINavigationController push) |
| `back` | browser/gesture POP **or** a `<Link>` back to the previous stack entry | old page slides off to the right ON TOP; previous page slides back from −30% underneath (pop) |
| `tab` | tab-root ↔ tab-root | instant swap — the persistent chrome never animates |
| `swipe` | after a committed swipe-back gesture | instant swap — the finger already animated the exit (prevents a double animation / flash) |

Key implementation details (don't regress these):

- **Direction is computed once per location change and cached in a ref** — re-renders
  during an in-flight animation can never flip variants mid-transition (that caused flashing).
- **An in-app history stack** (`navRef.current.stack`) detects "back" even when it
  happens via a `<Link>` (header Back buttons), not just browser POP, so those play
  the pop animation instead of a wrong-direction push.
- **Pages are absolutely stacked** (`absolute inset-0`), NOT `mode="popLayout"` — the
  exiting page keeps its exact size/position while both are on screen (no layout jump).
- z-index comes from the variants so the moving page is always on top, exactly like iOS.
- Spring physics (`stiffness 400, damping 42`) for push/back; **Reduce Motion** → short crossfade.
- No permanent `will-change` — framer-motion promotes GPU layers only while animating
  (WKWebView / Low Power Mode perf, see `DOM_OPTIMIZATION.md`).
- Tab pages render `GlassHeader` + `GlassTabBar` OUTSIDE the animated container, so
  the chrome stays perfectly still while pages move under it.

## 4. Edge swipe-back — `src/components/SwipeBack.jsx`

iOS-style swipe-from-left-edge to go back, on every page except tab roots:

- Gesture must start within 28px of the left edge; vertical scroll wins.
- The gesture only arms when there IS a previous history entry
  (`history.state.idx > 0`) — on a deep-linked/cold-start first page a committed
  swipe would otherwise slide the page off with nowhere to navigate (blank screen).
- A cancelled touch (incoming call, OS gesture) springs the page back instead of
  leaving it stuck half-dragged.
- The finger drags the page 1:1 via `translate3d` — one DOM write per frame (rAF-batched).
- Release past 33% of the width (or a quick flick) commits: the page finishes sliding
  off via a CSS transition, then `navigate(-1)` fires.
- **`src/lib/navMotion.js`** — a shared flag set right before `navigate(-1)` telling
  `AnimatedRoutes` the exit was already animated, so the router swaps instantly
  instead of replaying a second slide. Removing this brings the post-swipe flash back.

## 5. Auth guarding — `src/components/ProtectedRoute.jsx`

All non-public pages are nested under `ProtectedRoute` inside `AnimatedRoutes`.
Unauthenticated visits redirect to `/login` via `RedirectToLogin`, which carries
the intended destination in `location.state.from` — after signing in (any method),
`Login`/`EmailLogin` return the user to where they were headed instead of `/`. The `/auth` and `/oauth/auth` routes MUST
stay public — the native OAuth deep link re-enters the app through them (see
`DESPIA_OAUTH.md` and `src/main.jsx`, which stashes tokens and normalizes the URL
before React mounts).

## 6. Scroll behavior — `ScrollToTop.jsx` + `ScrollMemory.jsx`

Forward navigations start at the top (pages remount) and `#hash` targets are
scrolled to inside the page's `.scroll-container`. **`ScrollMemory`** records each
page's scroll position while the user scrolls (passive listener) and restores it
when the page is re-entered via a back/swipe navigation — native-style scroll
restoration despite pages remounting for the route transitions. It reads the
navigation direction from `src/lib/navMotion.js` (written by `AnimatedRoutes`).

## Adding a page — checklist

1. Drop `src/pages/YourPage.jsx` in the folder → route exists, animated, swipe-back enabled.
2. Public? Add its path to `PUBLIC_PATHS`.
3. Should be a bottom tab? Add it to `TABS` (it then loses swipe-back and gains the chrome).
4. Custom URL? Add to `PATH_OVERRIDES`.