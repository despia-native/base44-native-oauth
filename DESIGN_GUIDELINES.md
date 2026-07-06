# DESIGN_GUIDELINES.md — Native-First UI Rules (MANDATORY)

Every screen generated for this app must feel like a **native iOS/Android app**,
never like a website wrapped in a WebView. These rules are not suggestions —
generated code that violates them is wrong. The design system that implements
them lives in `src/index.css` (tokens + "ember" materials) and
`tailwind.config.js` (token → class mapping).

---

## 1. The Golden Rule

> If a screen would look normal in a desktop browser with a mouse, it is not
> finished. Design for a thumb on a 390px-wide glass slab first, then let it
> breathe on iPad/desktop.

Tell-tale "wrapped web app" smells — **all forbidden**:

- Body/page scrolling, visible scrollbars, white overscroll rubber-band flash
- Blue tap highlights, text-selection on buttons, double-tap zoom, input zoom
- Hover-only affordances (`hover:` as the ONLY feedback), tiny click targets
- Underlined blue links as primary actions, default browser focus outlines
- Content jammed under the notch or behind the home indicator
- Full-width stretched content on iPad, desktop-style dense tables on phones
- Instant, animation-less state changes; browser `alert()` / `confirm()`

---

## 2. App Shell & Scrolling (already wired — never break it)

- `html, body` are `overflow: hidden`; `#root` is a fixed flex column.
  **Pages never scroll the body.** Every page is `flex flex-col h-full` with a
  single `.scroll-container` child for its scrollable content (momentum
  scrolling, hidden scrollbar, `overscroll-behavior: contain` built in).
- Navigation chrome floats OVER content: `GlassHeader` (floating capsule) and
  `GlassTabBar` (floating liquid-glass tab bar) stay static while pages push /
  swipe beneath them via `AnimatedRoutes`.
- Never introduce a second nested vertical scroll region on one screen.

## 3. Safe Areas (non-negotiable)

- Top of every page: `pt-safe-top` or
  `style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + <chrome offset>px)' }}`
  when a floating header overlays content.
- Bottom: `pb-safe-bottom`, and pages under the tab bar end with a spacer
  (`<div className="h-32" />`) so content scrolls clear of it.
- Drawers/sheets pad their footer with
  `calc(var(--safe-area-bottom, 0px) + 20px)`.
- Never hardcode notch guesses (`pt-12` "for the notch") — always the tokens.

## 4. Responsive Layout — Phone → iPad → Desktop

- **Phone (default):** full-bleed single column, `px-5` gutters.
- **iPad/desktop:** content must never stretch edge-to-edge. Wrap page content
  in `.page-wrap` (30rem → 36rem @48rem → 42rem @64rem, centered) or an
  explicit `max-w-* mx-auto`. Auth/CTA stacks: `max-w-sm md:max-w-md mx-auto`.
- Sheets and drawers stay bottom-anchored on all sizes (this app's pattern);
  they must also be width-capped on iPad, not wall-to-wall.
- Test mentally at 320px, 390px, 768px, 1024px+. Nothing may overflow
  horizontally at 320px.
- Use `rem`-based Tailwind spacing; typography uses the fixed native scale
  below (it does not need to grow on iPad — the column cap does the work).

## 5. Materials — the "Ember" system (use ONLY these)

One visual language, two materials. Never invent ad-hoc shadows, borders or
gradients; never use raw shadcn default styling for primary surfaces.

| Class | Use for |
|---|---|
| `ember-glass` / `ember-glass-hi` | secondary buttons, chips, secondary surfaces |
| `ember-primary` | THE main action of a screen (high-contrast convex) |
| `ember-accent` | the one loud ember-orange action (max one per screen) |
| `ember-danger` | destructive actions |
| `ember-card` | raised content cards / grouped lists (`rounded-3xl` + `overflow-hidden`) |
| `ember-track` | recessed tracks: progress, switches, skeleton bases |
| `ember-input` | all text inputs (pill, 3.5rem tall) |
| `liquid-glass` | floating chrome only (header capsule, tab bar) |
| `ios-sheet` | bottom sheet surface (squircle top corners) |

- Colors/fonts come ONLY from tokens (`bg-background`, `text-foreground`,
  `text-muted-foreground`, `bg-primary/10`, `text-destructive`, …). No
  hardcoded hex, no `bg-white`, no inline color styles. Dark mode must work
  automatically — if you typed a hex value in JSX, you broke it.
- Fonts: the rounded system stack is already global (`font-body` etc.) —
  SF Pro Rounded on Apple. Never import web fonts for UI text.

## 6. Touch & Interaction — every tappable thing

- Minimum hit target **44×44pt**. Primary buttons: `h-14 rounded-full`.
- Every tappable element gives PRESS feedback, not hover feedback:
  `ember-press` / material classes (spring `scale(.95)` + shadow crossfade),
  or `active:opacity-60` for plain text buttons, or `active:bg-muted/60` for
  list rows. `hover:` may only ever be an *addition* for desktop.
- Haptics on meaningful actions (`src/lib/haptics.js`): `haptics.heavy()` on
  destructive/major taps, `haptics.success()` / `haptics.error()` on outcomes,
  light ticks on tab switches. Web no-ops automatically.
- Full-screen route changes push horizontally (handled by `AnimatedRoutes`);
  sub-flows within a screen use drawers, not new browser-looking pages.

## 7. Native Idioms (use these, not web idioms)

- **Bottom sheets/drawers** (`Drawer` from `@/components/ui/drawer`, with
  `DrawerHeightAnimator` already integrated) for confirmations, pickers and
  short flows — never `window.confirm`, rarely centered modals.
- **Grouped inset lists** (`ember-card` + `ListRow`) for settings/detail rows —
  never bare `<table>` or dense link lists on mobile.
- **Section labels**: `text-[13px] font-semibold uppercase tracking-wider
  text-muted-foreground` above each group (iOS style).
- **Page dots** (`ember-dot`) for carousels; **skeletons** (`ember-skel`) while
  loading — never blank screens or browser spinners; the `ember-spinner` is for
  in-button loading only.
- **Errors**: inline text + `ember-shake` on the field group + `haptics.error()`.
  Never `alert()`.
- **Typography scale** (fixed px, iOS-like): page titles 24–26px bold tight;
  card/row titles 15–17px semibold; body 14–15px; captions/labels 12–13px.

## 8. Motion

- Springs, not linear fades: use the CSS vars `var(--spring)` /
  `var(--ease-out)` or the prebuilt classes (`ember-press`, `ember-pop-in`,
  `ember-tab-pop`, `animate-sheet-in`).
- Animate ONLY compositor-friendly properties: `transform`, `translate`,
  `scale`, `opacity`. Never animate `box-shadow`, `height` (use
  `DrawerHeightAnimator`), `width`, or layout properties per-frame.
- Respect `prefers-reduced-motion` (already globally handled — don't bypass it
  with JS-driven loops).
- Every state change is animated *briefly* (150–350ms). No animation is a bug;
  a 700ms animation is also a bug.

## 9. Forms & Inputs

- `ember-input` for all text fields; inputs keep `font-size ≥ 16px` (global —
  prevents iOS zoom). Correct `type=` and `autoComplete`/`inputMode` attributes
  so the right keyboard appears (`email`, `numeric`, `tel`…).
- Submit buttons: disabled + spinner/"Please wait…" while in flight,
  `disabled:opacity-40`.
- One primary action per screen. Secondary actions are glass or plain text.

## 10. New-Screen Checklist

1. `flex flex-col h-full bg-background` root + one `.scroll-container`.
2. Safe-area padding top & bottom; `h-32` spacer if under the tab bar.
3. Content wrapped in `.page-wrap` (or equivalent max-width) for iPad/desktop.
4. Only ember materials + design tokens — zero hardcoded colors/shadows.
5. All targets ≥44pt with press feedback; haptics on key actions.
6. Loading = skeletons; errors = inline + shake; confirms = drawer.
7. Route registered in `AnimatedRoutes`; works in light AND dark mode.
8. Nothing overflows at 320px; nothing stretches full-width at 1024px.