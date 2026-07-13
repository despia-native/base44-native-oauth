# Base44 Mobile App Starter Project (Store-Review-Ready)

A production-grade **mobile app starter template** and **boilerplate** for shipping **real native iOS and Android apps** — built with **React, Vite, and Tailwind CSS** on the [Base44](https://base44.com) **no-code / low-code backend** (serverless functions, database, auth, email) and packaged as a native app with [Despia](https://despia.com) (a **web-to-app / WebView-to-native converter** with OTA updates and a native bridge).

A complete, **store-review-ready foundation** — it handles the common hybrid-app rejection points for the App Store and Google Play — for launching a **hybrid mobile app** fast: a native-feel **iOS-style UI kit**, **custom JWT authentication** with Google Sign-In, Sign in with Apple and **guest login**, in-app **account deletion**, **push notifications**, **in-app purchases / premium subscriptions (RevenueCat)**, an **admin dashboard**, and hardened **database security (row-level security)**.

Perfect for indie hackers, startups, and agencies building an **MVP mobile app**, converting a **web app to a native app**, publishing a **React app to the App Store**, or launching a **SaaS mobile client** without writing Swift or Kotlin.

**📖 Start here — all documentation lives in [`docs/`](./docs/README.md):**
- [`docs/TEMPLATE_SETUP.md`](./docs/TEMPLATE_SETUP.md) — the checklist to make this app yours (config, secrets, external accounts).
- [`docs/DESIGN_GUIDELINES.md`](./docs/DESIGN_GUIDELINES.md) — the mandatory native-first UI system (app shell, materials, motion).
- [`docs/JWT_AUTH.md`](./docs/JWT_AUTH.md) — the custom authentication system (single source of truth for auth).
- [`docs/DESPIA_OAUTH.md`](./docs/DESPIA_OAUTH.md) — how Despia, Base44, and Google OAuth fit together.

---

## ✅ Store-Review-Ready Foundation

Everything Apple and Google review teams commonly reject hybrid apps for is already handled (a strong foundation — not a guarantee of approval):

| Requirement | How this starter satisfies it |
|---|---|
| **Sign in with Apple** (required when offering Google login on iOS) | Native Apple Sign-In (`appleSignIn`, `src/lib/appleAuth.js`) |
| **Guest / loginless use** | Automatic anonymous device accounts — the app is always usable without forcing sign-up (`src/lib/deviceAuth.js`) |
| **In-app account deletion** (App Store 5.1.1(v)) | Two-step delete flow with biometric (native) or typed (web) confirmation — `docs/ACCOUNT_DELETION.md` |
| **Native look & feel** (no "wrapped website" rejections) | Full native-first design system: no body scroll, safe areas, spring page transitions, iOS sheets, haptics — `docs/DESIGN_GUIDELINES.md` |
| **Performance in WebView** | GPU-only animations, rAF-batched DOM work, Low Power Mode–safe — `docs/DOM_OPTIMIZATION.md` |
| **Accessibility** | WCAG 2.1 AA with VoiceOver/TalkBack support throughout — `docs/ACCESSIBILITY.md` |
| **In-app purchases** | RevenueCat integration for premium subscriptions (`src/lib/revenuecat.js`, `src/lib/PremiumContext.jsx`) |
| **Privacy / data security** | Deny-all RLS on every entity; all data access via authenticated backend functions — `docs/DB_SECURITY.md` |

> ⚠️ **Recommended before public launch: add rate limiting.** The auth endpoints (login, register, password reset) ship without app-level per-IP / per-email throttling. Add throttling (e.g. an attempt counter per email + per IP with a cooldown) before exposing sign-up to the public — see the known tradeoffs in `docs/DESPIA_OAUTH.md`.

## 📱 What's Included

### Native-first UI system (iOS-style design kit)
- **Native app look and feel** in a WebView: app shell with no body scroll, dedicated scroll containers, and **safe-area / notch handling** (Despia-injected + `env()` fallback).
- **Ember design system**: token-driven **dark mode / light mode themes**, glassmorphism materials, one accent action per screen (`src/index.css`).
- **iOS-style navigation**: spring push/pop **page transitions**, edge **swipe-back gesture**, static tab-root switching, floating **liquid-glass header + bottom tab bar** (`src/components/AnimatedRoutes.jsx`, `src/components/mobile/`).
- Native **bottom sheets / drawers** (vaul) with spring easing, animated height, and iOS grabber.
- **Haptic feedback**, tap-scale press states, reduced-motion support — **smooth 60fps animations** tuned for WKWebView and Android WebView.

### Custom JWT authentication
A complete, self-owned **mobile authentication system**: **social login (Google OAuth + Sign in with Apple)**, **email/password login**, **passwordless guest mode**, and **secure JWT session management** (independent of Base44's built-in login):
- Users live in the **`Account` entity**; sessions are app-signed **HS256 JWTs** (`JWT_SECRET`).
- Sign-in methods: **email/password, Google (native OAuth via Despia's `oauth://` bridge), Apple, and automatic anonymous device accounts** (guest mode).
- Guest → real account upgrading, multi-account switcher, saved accounts, password reset via email (Resend), account linking.
- Backend: `auth*`, `googleSignIn`, `appleSignIn`, `deviceSignIn` functions. Frontend: `src/lib/customAuth.js` + `src/lib/AuthContext.jsx`.
- Required secrets: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`.

Full flows and security practices: [`docs/JWT_AUTH.md`](./docs/JWT_AUTH.md).

### Native capabilities (via Despia)
| Feature | Mechanism |
|---|---|
| Native Google Sign-In | `oauth://` bridge → secure in-app browser → deep link back (`myapp://oauth/auth`) |
| Session persistence across reinstalls | Despia **Storage Vault** (`src/lib/tokenVault.js`) |
| Biometric confirmation | Locked vault read (`src/lib/biometricConfirm.js`) |
| Push notifications | Despia push bridge (`src/lib/push.js`, `sendPush` function) |
| Haptics | `despia-native` package (`src/lib/haptics.js`) |
| Instant boot / offline / OTA updates | `@despia/local` Vite plugin — the web build is served from `http://localhost` on-device |
| Safe areas / native chrome | `--safe-area-*` variables injected by the shell |

In a plain browser the app still runs (web preview); native-only features gracefully fall back.

### Premium subscriptions & monetization
**RevenueCat in-app purchases** for **app monetization**: subscription billing, a `PremiumContext` provider, and **paywall-ready UI** — purchases stay tied to the device/account per Apple and Google store rules.

### Admin panel / dashboard
Role-gated **admin dashboard** pages: **user management** with analytics, stats and login charts (`/admin/users`), and a **push-notification composer** for targeted push campaigns (`/admin/push`).

### Database security
Every entity ships with a **deny-all RLS block** — zero direct client database access. All reads/writes flow through backend functions that verify the app JWT and use the service role. Rules and checklist: [`docs/DB_SECURITY.md`](./docs/DB_SECURITY.md).

## 🗂 Project Docs

All documentation lives in the [`docs/`](./docs/README.md) folder — see [`docs/README.md`](./docs/README.md) for the full index.

| Doc | Covers |
|---|---|
| `docs/TEMPLATE_SETUP.md` | Per-project setup checklist |
| `docs/JWT_AUTH.md` | The complete auth system |
| `docs/DESPIA_OAUTH.md` | OAuth in WebViews, deep links, native bridge |
| `docs/APPLE_SIGN_IN.md` | Sign In with Apple setup & flows |
| `docs/GOOGLE_LOGIN_BASE44_LIMITATIONS.md` | Why built-in auth couldn't be used |
| `docs/ACCOUNT_DELETION.md` | Store-compliant deletion flow |
| `docs/DESIGN_GUIDELINES.md` | Native-first UI rules |
| `docs/ROUTER.md` | Routing, transitions, swipe-back navigation |
| `docs/ICONS.md` | Framework7 Icons system & vocabulary |
| `docs/DOM_OPTIMIZATION.md` | Animation & WebView performance rules |
| `docs/ACCESSIBILITY.md` | Accessibility standard & checklist |
| `docs/DB_SECURITY.md` | Deny-all RLS and data-access rules |
| `docs/PUSH_NOTIFICATIONS.md` | Push setup and sending |
| `docs/ANTI_FREEZE.md` | Never-block-the-UI rules for native bridge calls |
| `docs/DESPIA_NATIVE.md` | Working with Despia native features |

> ℹ️ **Keep the Base44 setup below intact.** This project runs *on* Base44 — the CLI, config, and hosted-backend steps are how you run, edit, and publish it.

---

## Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) if you want to run Base44 commands directly.

## Run Locally

Run the full local development environment from the project root:

```bash
base44 dev
```

`base44 dev` starts the local Base44 development backend and, when this app is configured for it, also starts the frontend dev server for you. Use the frontend URL printed by the command.

For example, when the Base44 project config includes a `serveCommand`, `base44 dev` can launch the frontend too:

```json5
{
  "site": {
    "serveCommand": "npm run dev"
  }
}
```

In a Base44 project this lives in `base44/config.jsonc`.

## Run Only The Frontend

If you only want to work on the frontend against the hosted Base44 backend, run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Use The Hosted Backend

For frontend-only development, create or update `.env.local` in the project root:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

`VITE_BASE44_APP_ID` identifies the Base44 app.

`VITE_BASE44_APP_BASE_URL` tells the Base44 Vite plugin where to send local `/api` requests. Point it at your deployed Base44 app URL when you want the local frontend to use the hosted backend.

When you use `base44 dev`, the command injects the local Base44 values for you, so `.env.local` is mainly needed for frontend-only workflows.

## Publish Your Changes

After pushing your changes to git, open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

## Docs & Support

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Base44 CLI command reference: [https://docs.base44.com/developers/references/cli/commands/introduction](https://docs.base44.com/developers/references/cli/commands/introduction)

Support: [https://app.base44.com/support](https://app.base44.com/support)