# DOM_OPTIMIZATION.md — Animation & WebView Performance Rules (MANDATORY)

Why this exists: in **iOS Low Power Mode** (and on low-end Android) WebViews
drop to ~30–60Hz and throttle the main thread. Any animation that does work on
the JS main thread per frame — or forces layout/paint per frame — visibly
stutters. These rules keep every animation on the compositor (GPU) and cap JS
work at one unit per rendered frame.

---

## 1. The Hierarchy (always prefer the highest that works)

1. **Pure CSS** — transitions/keyframes on `transform` / `translate` / `scale`
   / `opacity` only. Runs on the compositor thread; immune to JS jank and Low
   Power Mode throttling. This is why the ember kit (`ember-press`,
   `ember-dot`, `ember-shake`, `ember-skel`, `animate-sheet-in`, …) is CSS-only.
2. **CSS driven by a single JS write** — JS measures/decides ONCE, sets a
   `transform`, and a CSS `transition` does the actual animation (GlassTabBar
   gliding pill, SwipeBack commit/cancel).
3. **rAF-batched JS** — only for finger-tracking, where styles must follow
   input. Batch ALL DOM writes through one `requestAnimationFrame` per frame.
4. **framer-motion** — route transitions and height springs only. Never for
   things CSS can do.

## 2. rAF Batching & Debouncing (rules for any JS-driven motion)

- High-frequency events (`touchmove`, `scroll`, `resize`, ResizeObserver
  bursts) fire faster than the display refreshes. **Never write to the DOM or
  call `setState` directly from them.** Store the latest value in a ref and
  flush once per frame via `requestAnimationFrame`; skip scheduling if a frame
  is already pending (`if (rafId.current) return`).
- `setState` from these paths must be change-gated:
  `setX((v) => (v === next ? v : next))` — a no-op render is still a render.
- Always `cancelAnimationFrame` on unmount and before starting a terminal
  CSS transition (so a stale frame can't overwrite it).
- Implemented in: `SwipeBack.jsx` (touchmove → one `translate3d` write/frame),
  `OnboardingCarousel.jsx` (scroll → rAF-throttled, change-gated dot state),
  `GlassTabBar.jsx` (resize → rAF-debounced re-measure).

## 3. Layer Hygiene (WKWebView + Android WebView)

- **`translate3d(x,0,0)` over `translateX(x)`** for JS-written transforms —
  guarantees GPU-layer compositing in both WebViews.
- **`will-change: transform` is a scoped tool, not a default.** Apply it when
  a gesture/animation STARTS, remove it when it ends (SwipeBack does this).
  A permanent `will-change` on a full-page element pins a viewport-sized GPU
  texture forever — memory pressure is exactly what Low Power Mode punishes.
  (The old permanent `willChange` on the route container was removed;
  framer-motion promotes the layer only while animating.)
- **Pin static chrome to its own layer**: `.liquid-glass` (header capsule, tab
  bar) carries `transform: translateZ(0)` + `backface-visibility: hidden` so
  its 28px backdrop blur is rasterized ONCE and composited — not re-blurred
  every frame while pages slide underneath it.
- **Never animate paint-heavy properties**: `box-shadow`, `backdrop-filter`,
  `filter`, `height`, `width`, `top/left`. Press states cross-fade a
  pre-painted `::after` shadow overlay via `opacity` (see `src/index.css`) —
  keep using that pattern. Keep shadows on MOVING layers small: blur radius
  rasterizes with the layer (route-transition edge shadow was reduced).

## 4. Scrolling & Gestures

- Horizontal carousels/pagers: **CSS scroll-snap**, never JS-driven translate
  loops. The swipe is then fully compositor-driven; JS only observes.
- `touch-action` is set (`pan-x` on carousels, `manipulation` globally) so the
  WebView compositor never blocks waiting for JS to maybe-preventDefault.
- Scrolling stays inside `.scroll-container` (`-webkit-overflow-scrolling:
  touch`, `overscroll-behavior: contain`) — body scroll is disabled app-wide.
- Passive listeners: React's `onScroll`/`onTouchMove` handlers here never call
  `preventDefault`, so the compositor scrolls without waiting on JS.

## 5. Reduced Motion / Low Power

- CSS: a global `prefers-reduced-motion: reduce` override collapses all CSS
  animations/transitions to ~0ms (already in `src/index.css`).
- framer-motion does NOT honor it automatically — use `useReducedMotion()` and
  swap to a short fade (route transitions do this in `AnimatedRoutes.jsx`).
- Design animations to still be acceptable at 30fps: short (150–350ms),
  transform/opacity only, no chained JS timers per frame.

## 6. Checklist for Any New Animation

1. Can CSS do it alone? → do that (add a kit utility in `src/index.css`).
2. JS needed? → JS sets a value once, CSS transition animates it.
3. Finger-tracking? → rAF-batch writes, `translate3d`, scoped `will-change`,
   cancel the rAF on end/unmount.
4. Only `transform`/`opacity` animate; shadows via `::after` opacity.
5. High-frequency events never `setState` unthrottled or ungated.
6. Works under `prefers-reduced-motion` (CSS is automatic; framer needs
   `useReducedMotion()`).