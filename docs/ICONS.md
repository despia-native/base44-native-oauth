# Icons — Framework7 Icons (iOS / SF Symbols style)

This app uses **Framework7 Icons** (`framework7-icons` npm package) for all UI
iconography — the same visual language as Apple's SF Symbols, so the app feels
native on iOS. Generic icon sets (lucide etc.) are NOT used in app code.

> Browse every available icon and its exact name: **https://framework7.io/icons/**
> Names are lowercase with underscores, e.g. `person_crop_circle_fill`.

**Source repo / official docs: https://github.com/framework7io/framework7-icons**
Agents and maintainers should look up this repo for the authoritative docs,
usage instructions, changelog, and the complete icon list — the full set of
valid ligature names lives in the repo (see the `icons/` SVG folder and the
font's codepoints), which is the reliable way to verify an icon name exists
before using it.

---

## 1. How it works

Framework7 Icons is a **ligature icon font**: you render an `<i class="f7-icons">`
element whose text content is the icon name, and the font swaps it for the glyph.
The font CSS is imported once in `src/main.jsx`:

```js
import 'framework7-icons/css/framework7-icons.css'
```

All rendering goes through one tiny wrapper — **`src/components/F7Icon.jsx`**:

```jsx
import F7Icon from '@/components/F7Icon'

<F7Icon name="chevron_left" size={22} className="text-primary" />
```

| Prop | What it does |
|---|---|
| `name` | Framework7 Icons ligature name (from framework7.io/icons) |
| `size` | Glyph size in px (drives `font-size`; default `20`) |
| `className` | Tailwind classes — color comes from `currentColor`, so `text-*` classes work |

The wrapper sets `line-height: 1`, `select-none`, `shrink-0`, and `aria-hidden`
so icons behave like fixed-size decorative glyphs everywhere.

**Never** size an F7Icon with `w-* h-*` classes — the glyph is font-sized, so
width/height classes clip or misalign it. Always use the `size` prop.

---

## 2. Where icon names are passed as strings

Some components take icon **names** (strings), not components:

| Place | Prop | Example |
|---|---|---|
| `src/components/mobile/ListRow.jsx` | `icon` | `<ListRow icon="envelope_fill" … />` |
| `src/config/navigation.js` → `TABS` | `icon` | `{ path: '/', title: 'Home', icon: 'house_fill' }` |
| `src/pages/Login.jsx` → `SLIDES` | `icon` | onboarding slides render via `OnboardingCarousel` |
| `src/pages/Debug.jsx` status object | `icon` | status card icon |

When adding a tab, list row, or onboarding slide, just pass the F7 name string.

---

## 3. Icon vocabulary used in this app

Consistent name choices — reuse these instead of inventing near-duplicates:

| Meaning | F7 name |
|---|---|
| Home tab | `house_fill` |
| Account / profile | `person_crop_circle_fill` |
| Person / user | `person_fill` |
| Users / members | `person_2_fill` |
| Add account / link | `person_badge_plus_fill` |
| Email | `envelope_fill` |
| Back chevron | `chevron_left` |
| Row disclosure | `chevron_right` |
| Close / remove | `xmark` |
| Confirm / check | `checkmark` |
| Verified badge | `checkmark_seal_fill` |
| Security / protected | `checkmark_shield_fill` |
| Admin shield | `shield_fill` |
| Danger / warning | `exclamationmark_shield_fill` |
| Biometric confirm | `lock_shield_fill` |
| Password / lock | `lock_fill` |
| Reset access | `lock_open_fill` |
| Success circle | `checkmark_circle_fill` |
| Notifications | `bell_fill` |
| Notifications off | `bell_slash_fill` |
| Sign out | `square_arrow_right` |
| Delete | `trash_fill` |
| Send push | `paperplane_fill` |
| Download / export | `square_arrow_down` |
| Premium | `star_fill` |
| Settings / manage | `gear_alt_fill` |
| Debug | `ant_fill` |
| Web / globe | `globe` |
| Layers / features | `square_stack_3d_up_fill` |
| Sync / cloud | `cloud_fill` |

Prefer the `_fill` variants — filled glyphs match iOS tab bars and list rows.

---

## 4. Exceptions (not F7Icon)

| What | Why |
|---|---|
| `src/components/GoogleIcon.jsx` / `AppleIcon.jsx` | Brand logos must use official artwork (SVG), never a generic icon |
| `.ember-spinner` (CSS class in `src/index.css`) | Loading spinners are a CSS animation, not an icon glyph |
| shadcn/ui internals (`src/components/ui/*`) | Ship with their own built-in lucide icons — leave them alone |
| `src/lib/PageNotFound.jsx` | Platform boilerplate with an inline SVG — untouched |

`lucide-react` stays installed **only** because shadcn/ui components depend on
it internally. Do not import it in app pages/components.

---

## 5. Adding a new icon (checklist)

1. Find the name at https://framework7.io/icons/ (verify it exists — a wrong
   name renders as literal text, not a broken image).
2. Render it: `<F7Icon name="…" size={18} className="text-…" />`.
3. Color via Tailwind `text-*` classes; size via the `size` prop only.
4. If it expresses a meaning already in the vocabulary table above, reuse that
   name for consistency.