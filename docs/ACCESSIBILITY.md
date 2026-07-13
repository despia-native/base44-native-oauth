# ACCESSIBILITY.md — App Accessibility Standard (MANDATORY)

The app targets **WCAG 2.1 AA** adapted for a native-hybrid mobile app
(VoiceOver on iOS / TalkBack on Android are the primary assistive
technologies, since the app ships in WKWebView / Android WebView). Every new
screen and component must follow these rules — they are already implemented
across the existing UI.

---

## 1. What's Implemented (and must be preserved)

### Semantics & landmarks
- One `<h1>` per screen (page titles / `GlassHeader` title); headings nest in
  order, `<header>`, `<nav>`, `<form>` landmarks used where they apply.
- The tab bar is `<nav aria-label="Main menu">`; the active tab carries
  `aria-current="page"`.
- List groups use real `<button>` elements (`ListRow`), never clickable divs —
  keyboard focusable and screen-reader actionable for free.

### Labels & names
- Every input has an accessible name: `aria-label` matching its placeholder
  (placeholder alone is NOT a label) — auth forms, link-account, reset flows,
  delete confirmation.
- Correct `autoComplete` (`email`, `name`, `current-password`, `new-password`)
  and `inputMode` so password managers and the right keyboard work.
- Icon-only buttons always carry `aria-label` (e.g. "Remove account from this
  device" in the account picker).
- Decorative images/icons: avatars use `alt=""`; icon glyphs (`F7Icon`) are
  `aria-hidden` by default; explicit `aria-hidden="true"` wherever an icon
  sits next to its own text.

### Live announcements (screen readers hear state changes)
- Errors: every inline error `<p>` has `role="alert"` — announced immediately
  (login, email login, link account, reset password, delete drawer).
- Async progress: loading screens use `role="status"` + visible text ("Setting
  up your session…"); in-button spinners pair `aria-hidden` spinners with an
  `sr-only` status text ("Deleting account…").
- Success/confirmation states use `role="status"` (reset-link sent, password
  updated).
- Onboarding carousel: `aria-roledescription="carousel"`, each slide labeled
  "N of M", page dots are `aria-hidden` decoration, and an `sr-only`
  `aria-live="polite"` region announces the current slide and title.

### Keyboard & focus
- Global visible focus ring: an ember `:focus-visible` outline on every
  focusable element (`src/index.css`), suppressed for touch (`:focus` without
  `:focus-visible`) — keyboard users always see where they are.
- All flows are completable with keyboard alone: real buttons/forms, Enter
  submits, drawers (vaul/Radix) trap focus, restore it on close, and close on
  Escape.
- Submit buttons disable while in flight (`disabled` + `disabled:opacity-40`),
  preventing double submission for everyone.

### Dialogs & sheets
- Bottom sheets use the Radix-based `Drawer`: proper `role="dialog"`,
  `aria-modal`, focus trap, and a `DrawerTitle` naming every sheet.
- Destructive flows (account deletion) are two explicit steps with clear text
  — never a timing-based or gesture-only confirmation.

### Visual & motor
- Touch targets ≥ 44×44pt (buttons `h-14`, rows `py-3` full-width, ×-buttons
  padded).
- Color is never the only signal: destructive rows pair red with an icon and
  explicit wording; errors are text, not just red borders.
- Token palette maintains AA contrast in BOTH light and dark themes
  (`--foreground`/`--background`, `--muted-foreground` for large/secondary
  text only). Never place `muted-foreground` body text on `muted` surfaces.
- Text ≥ 16px in inputs (also prevents iOS zoom); body 14–15px semibold+
  rounded stack for readability; the layout is rem-based and reflows with the
  OS text-size setting.
- `prefers-reduced-motion: reduce` collapses all CSS animation globally;
  framer-motion route transitions honor it via `useReducedMotion()`.

### Gestures
- No gesture-only functionality: edge swipe-back always has an on-screen Back
  button/link equivalent; carousel swiping has no required outcome (dots are
  informative, CTA buttons do the navigation).

## 2. Known Trade-off

- `user-scalable=no` in `index.html` disables pinch-zoom for the native-app
  feel (standard for hybrid shells; iOS Safari ignores it anyway). Mitigation:
  no text below 12px, rem-based layout, and OS-level text scaling + screen
  zoom still work inside the WebView.

## 3. Checklist for Every New Screen/Component

1. Interactive = `<button>`/`<a>`/`<input>` — never `div onClick`.
2. Every input: `aria-label` + correct `type`/`autoComplete`/`inputMode`.
3. Every icon-only control: `aria-label`; decorative icons: `aria-hidden`.
4. Errors: `role="alert"`. Async/loading/success: `role="status"` with real
   text (sr-only if visually redundant).
5. One `<h1>`, labeled landmarks, `aria-current` on active nav items.
6. Targets ≥ 44pt; visible `:focus-visible` state (global — don't remove it).
7. Flow works with keyboard only and reads sensibly top-to-bottom with
   VoiceOver/TalkBack.
8. Check contrast for any new color pairing in light AND dark mode.
9. Anything gesture-driven has a tap/button alternative.