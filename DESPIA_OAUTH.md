# Native Google OAuth + Custom Auth for Base44 Apps in Despia

A complete, production-tested guide for a **fully custom authentication system** that runs on [Base44](https://base44.com)'s backend, works with native Google Sign-In inside a [Despia](https://despia.com) WebView, and gives you total control over your users — something Base44's built-in auth can't do.

> **Status: working 100% in production.** Native Despia Google login, email/password, password reset, and admin user management all run through this system.

---

## TL;DR — What This Is

Instead of using `base44.auth` (Base44's built-in login), this app owns its **entire** auth stack:

- **Users live in a normal `Account` entity** you control — read, edit, delete, add fields, run analytics, invite anyone.
- **Sessions are your own signed JWTs** (HS256, `JWT_SECRET`), issued by your backend functions.
- **Google Sign-In works natively in Despia** via the `oauth://` bridge — no broken external-browser redirects.
- **Still 100% on Base44's backend** — Deno functions + entities + email. No separate server, no extra infra.

You get the flexibility of a hand-rolled auth system with the zero-ops convenience of Base44's backend.

---

## Who This Guide Is For

- You're building a Base44 app and wrapping it in **Despia** to ship a real native iOS/Android app.
- You need **Google Sign-In to work inside the native app**, not just on the web.
- You want to **own your users** — custom fields, your own admin tools, your own session rules — instead of being limited by a built-in auth model.

If you only need web login and Base44's `User` entity is enough for you, you probably **don't** need this — see [When NOT to Use This](#when-not-to-use-this) below. This guide is for the custom case.

---

## The Mental Model (read this first)

Before any code, get these four ideas straight. Everything else follows from them.

### 1. A Despia app is a WebView, and WebViews break normal OAuth

Despia doesn't rebuild your app natively — it loads your Base44 web app inside a **WebView** (an embedded browser view: `WKWebView` on iOS, `WebView` on Android). Your React app runs exactly as it does on the web.

The problem: the classic "Sign in with Google" flow is a **full-page redirect**. The browser leaves your site, goes to `accounts.google.com`, and Google redirects *back* to your site with the result. Inside a WebView, that "back" redirect often opens in the **system browser (Safari/Chrome), not your WebView** — so the token lands in a browser your app can't read, and the user is stranded. That's why "it works on the web but not in the app."

**The fix is to stop relying on a page redirect to bring the token home.** Instead we use two Despia-native mechanisms:
- **`oauth://` bridge** — hands Google's login page to a *secure in-app browser* Despia controls.
- **Custom-scheme deep links** (`myapp://…`) — the way a native app receives a URL and routes it back into the WebView. This is how the token gets *back into your app* reliably.

### 2. There are TWO different tokens — don't confuse them

This trips everyone up. Two completely different tokens exist in this flow:

| Token | Who issues it | What it proves | What you do with it |
|---|---|---|---|
| **Google authorization code** (`4/0A...`) | Google | "This person just proved their Google identity — once" | Send it to your backend **once**. Single-use, expires in minutes, useless without the server-held client secret. |
| **Your app JWT** | Your `googleSignIn` / `authLogin` backend | "This person is logged into *your* app as this Account" | Store it, and send it with every request. **This is the session.** |

The code is a *one-time proof of identity*. Your JWT is the *ongoing session*. The whole point of the `googleSignIn` backend function is to **trade the first for the second**: exchange the code with Google server-side (using `GOOGLE_CLIENT_SECRET`), read the verified identity from the returned `id_token`, find/create the Account, and mint your own JWT.

> If you ever find yourself trying to "log in with the Google code directly," stop — that's the confusion. The code never becomes the session, and no Google access token ever reaches the frontend at all.

### 3. A "session" here is just a signed string you trust

Your JWT is three base64 parts: `header.payload.signature`. The payload says who the user is (`sub`, `email`, `role`) and when it expires. The signature is an HMAC-SHA256 of the first two parts using your secret (`JWT_SECRET`).

Because only your backend knows `JWT_SECRET`, only your backend can produce a valid signature — so when a request arrives carrying a JWT, the backend re-computes the signature and, if it matches, **trusts the payload without a database lookup for the identity**. That's the entire idea of a stateless session. No session table, no server memory — the token *is* the proof.

Consequences to internalize:
- **Change `JWT_SECRET` → every existing session dies** (old signatures no longer verify). Set it once, keep it stable.
- **The token is self-contained** — it works the same on web and inside Despia, in `localStorage`, wherever.

### 4. Base44 is your backend, not your auth

The insight that makes this whole thing possible: **you can use Base44 purely as a serverless backend + database + email, and build auth yourself on top.** Deno functions run your logic, the `Account` entity stores your users, Resend sends your emails. You never call `base44.auth.*` for login. Base44 doesn't "know" your users are logged in — and it doesn't need to, because *your* functions enforce it by verifying the JWT.

---

## Why This Beats Base44's Built-In Auth

Base44's built-in auth (`base44.auth`) is fast to start with but limited. This custom system removes those limits while keeping the easy backend:

| | Base44 built-in auth | This custom system |
|---|---|---|
| **User records** | Read-only `User` entity — can't create, can't fully control | Your own `Account` entity — full CRUD, add any field |
| **Create users programmatically** | ❌ Only invite flow, no `create()` | ✅ `Account.create(...)` freely (register, seed, migrate) |
| **Custom fields on users** | Limited to `updateMe` extras | ✅ Any schema you want (`google_id`, `avatar_url`, `last_login_at`, …) |
| **Native OAuth in a WebView** | Breaks — redirect escapes to external browser | ✅ `oauth://` bridge keeps the token in-app |
| **Session token** | Opaque Base44 token, Base44 controls lifetime | ✅ Your own JWT — you set claims, expiry (30d here), rotation |
| **Password reset** | Base44-managed emails/templates | ✅ Your own tokens + your own Resend emails |
| **Admin over users** | Restricted | ✅ Full admin dashboard: list, change roles, delete, export CSV |
| **Runs on Base44 backend** | ✅ | ✅ **Still yes** — Deno functions, entities, email |

**Bottom line:** you keep Base44's easy serverless backend and database, but you're no longer boxed in by its auth model. Your users are just data you own.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React)                                             │
│                                                               │
│  Login.jsx ── email/pw ──► customAuth.login()  ─┐            │
│           └─ Google (Despia) ─► googleAuthUrl ──┼─► backend  │
│                                                  │            │
│  customAuth.js  ── stores OUR JWT in localStorage           │
│  AuthContext    ── calls authMe on boot, holds user state    │
│  ProtectedRoute ── gates routes on that state                │
└───────────────────────────┬─────────────────────────────────┘
                            │ base44.functions.invoke(fn, { ...payload, token })
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Base44 Deno functions)                              │
│                                                               │
│  authRegister      email/pw → hash → Account.create → JWT    │
│  authLogin         verify pw → JWT                            │
│  googleSignIn      exchange auth code → find/create → JWT    │
│  authMe            verify JWT → return Account                │
│  authRequestReset  make reset token → Resend email           │
│  authResetPassword verify reset token → new pw hash          │
│  googleAuthUrl     build Google OAuth URL (Client ID secret) │
│  adminUsers        admin-only: list / role / delete accounts │
│                                                               │
│  All read/write the  Account  entity via asServiceRole.       │
│  Sessions = HS256 JWT signed with JWT_SECRET.                 │
└───────────────────────────────────────────────────────────────┘
```

**Key idea:** the frontend holds *our* JWT in `localStorage` and passes it to backend functions. Each protected function verifies the JWT and looks up the `Account`. Base44's own auth is never used for login.

---

## How Despia and Base44 Fit Together

They occupy different layers and never fight over auth — that's *why* this works:

| Layer | Owned by | Responsibility |
|---|---|---|
| Native shell (iOS/Android app, app store presence, deep-link scheme) | **Despia** | Wrap the web app, provide the `oauth://` in-app browser, intercept `myapp://` deep links |
| Web app (React UI, routing, session storage) | **Your code** | Render UI, hold the JWT, gate routes |
| Serverless backend (Deno functions) | **Base44** (your code runs on it) | Verify tokens, hash passwords, mint JWTs, read/write the `Account` entity |
| Database (`Account` entity) + email (Resend) | **Base44** | Store users, send reset emails |
| Identity provider | **Google** | Confirm the user is who they say |

Despia's only job in auth is **transport**: get Google's login page open in a browser it controls, and get the resulting token *back into the WebView* via a deep link. It does not verify anything or store users. Base44's only job is **backend compute + storage**. Google is the source of identity truth. Your code is the glue that turns "Google says this email is real" into "this Account has a valid session."

Because Despia handles transport and Base44 handles compute, **neither one owns the session** — you do, via the JWT. That separation is the whole trick.

---

## Part 1 — Native Google Sign-In in Despia

### The Problem

When you wrap a web app in a native WebView (Despia), a standard browser OAuth redirect breaks — Google's redirect opens an **external browser**, and the token never returns to your app. We solve it with Despia's `oauth://` bridge and a static callback page.

### The Flow

```
User taps "Sign in with Google"   (Login.jsx detects Despia via User-Agent)
        │
        ▼
Login.jsx → base44.functions.invoke('googleAuthUrl', { deeplink_scheme })
        │  (backend builds the Google OAuth URL using the GOOGLE_CLIENT_ID secret)
        ▼
despia('oauth://?url=<google-oauth-url>')
        │  Despia opens a SECURE in-app browser → Google Sign-In UI
        ▼
User signs in → Google redirects to:
   https://your-app.base44.app/native-callback.html?code=4/0A...&state=myapp
        │
        ▼
native-callback.html reads the code + scheme, shows "Continue to app",
fires the deeplink:  myapp://oauth/auth?code=4/0A...
        │
        ▼
Despia intercepts the deeplink → WebView navigates to /oauth/auth?code=4/0A...
        │
        ▼
Auth.jsx → customAuth.loginWithGoogleCode(code)
        │  → backend googleSignIn: exchanges the code with Google
        │    (GOOGLE_CLIENT_SECRET, server-side), reads the identity from the
        │    id_token, finds/creates the Account, returns OUR OWN JWT
        ▼
✅ JWT stored in localStorage, AuthContext refreshed, user enters the app
```

> **Key insight:** the authorization code is not a session — it's a single-use ticket. Our `googleSignIn` backend function exchanges it with Google (only the backend holds the client secret), finds or creates the `Account`, and issues **our own JWT**. That JWT is the real session. No Google access token ever travels through a URL or reaches the frontend.

### Critical: Redirect URI Must Be Clean (No Query Params)

Google requires the redirect URI to **exactly match** what's registered in Google Cloud Console — including any query string.

- ✅ **Correct:** register `https://your-app.base44.app/native-callback.html` (no query string), and pass the deeplink scheme via the OAuth `state` param. Google returns `state` in the query string, so the callback page can read it alongside the code.
- ❌ **Wrong:** `...native-callback.html?deeplink_scheme=myapp` — forces you to register that exact query string; fragile and breaks if the scheme changes.

### Critical: Boot-Time Token Capture

The static host may collapse a deep-linked path like `/oauth/auth?code=...` down to `/` **before React mounts**. If that happens, the protected-root guard fires and bounces the user to `/login` before the code is ever read.

**Fix (in `main.jsx`):** before React mounts, check for a code/token anywhere in the URL. If one is present, stash it in `sessionStorage` and rewrite the URL to `/auth` (a public route). Now the guard can never intercept a code-bearing visit. `Auth.jsx` then consumes the stashed code (or reads it live, since the native WebView can swap the URL without reloading).

### Why `response_type=code` (Authorization Code Flow)

Google returns a single-use **authorization code** as a query param (`?code=...&state=myapp`) on `native-callback.html`. The static page doesn't — and can't — exchange it; it just forwards the code into the app via the deep link. The **backend** (`googleSignIn`) exchanges it at `https://oauth2.googleapis.com/token` using `GOOGLE_CLIENT_SECRET` and reads the verified identity from Google's signed `id_token`.

Why this beats the implicit flow (`response_type=token`):
- **No access token ever appears in a URL** — only a code that is single-use, expires in minutes, and is useless without the server-held client secret.
- The identity comes from the `id_token`, returned directly to the backend over TLS.
- Google has deprecated the implicit flow for new integrations; the code flow is the current recommendation.

---

## Part 2 — The Custom Auth System

### Data Model — the `Account` entity

Your users are ordinary records you fully own:

| Field | Purpose |
|---|---|
| `email` | Lowercased, trimmed — unique identity |
| `full_name` | Display name |
| `password_hash` | PBKDF2 `salt:derivedKey` (hex). Empty for Google-only accounts |
| `google_id` | Google `sub` when linked to Google |
| `avatar_url` | Profile picture |
| `email_verified` | Boolean |
| `role` | `user` \| `admin` |
| `last_login_at` | Most recent successful login |

### Sessions — your own JWT

Every login path (`authRegister`, `authLogin`, `googleSignIn`) ends by signing an **HS256 JWT** with the `JWT_SECRET` env var, using Deno's built-in Web Crypto — no external libs:

```js
signJwt({ sub: account.id, email: account.email, role: account.role }, secret)
// header.payload.signature — 30-day expiry
```

The frontend stores this in `localStorage` (`app_auth_token`) and passes it to every backend call. `authMe` verifies the signature + expiry and returns the current `Account`.

### Passwords — PBKDF2, no dependencies

Registration hashes with PBKDF2 (100k iterations, SHA-256, random 16-byte salt), stored as `salt:hash` hex. Login re-derives with the stored salt and compares — all via Web Crypto, zero npm packages.

### Backend Functions

| Function | Role |
|---|---|
| `authRegister` | Validate + hash password → `Account.create` → return JWT |
| `authLogin` | Verify password (generic error, no user enumeration) → return JWT |
| `googleSignIn` | Exchange auth code with Google (client secret, server-side) → read `id_token` → find/create `Account` → return JWT |
| `authMe` | Verify JWT → return current `Account` |
| `authRequestReset` | Generate reset token → email via Resend (always generic success) |
| `authResetPassword` | Verify reset token → set new password hash |
| `googleAuthUrl` | Build the Google OAuth URL (keeps `GOOGLE_CLIENT_ID` off the frontend) |
| `adminUsers` | **Admin-only:** list / change role / delete accounts |

All use `base44.asServiceRole.entities.Account` and never touch Base44's built-in auth.

### Frontend Pieces

| File | Role |
|---|---|
| `src/lib/customAuth.js` | Token storage + thin wrappers over each backend function |
| `src/lib/AuthContext.jsx` | Calls `authMe` on boot, holds `user` / loading state app-wide |
| `src/components/ProtectedRoute.jsx` | Gates routes on the auth state |
| `src/lib/deeplinkToken.js` | Captures/stashes the OAuth code at boot |
| `src/pages/Login.jsx` | Email/pw + Google (native vs web branch) |
| `src/pages/Auth.jsx` | Consumes the Google auth code, exchanges it (via `googleSignIn`) for our JWT |
| `src/pages/ForgotPassword.jsx` / `ResetPassword.jsx` | Password reset UI |
| `src/pages/AdminUsers.jsx` | Admin dashboard (list, roles, delete, CSV export, login chart) |

---

## Setup Checklist

### Step 1 — Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID** → **Web application**
3. Under **Authorized redirect URIs**, add **exactly** (no trailing slash, no query string):
   ```
   https://YOUR-APP.base44.app/native-callback.html
   ```
4. Copy your **Client ID** and **Client Secret**

### Step 2 — Base44 Secrets

Dashboard → **Settings** → **Environment Variables**:

| Secret | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` |
| `JWT_SECRET` | a long random string — signs your session tokens |
| `RESEND_API_KEY` | for password-reset emails |
| `APP_BASE_URL` | your app's public Base44 URL, e.g. `https://YOUR-APP.base44.app` (no trailing slash) — must match the Google redirect URI domain |

### Step 3 — Deeplink Scheme

In `src/config/app-config.js`, set `deeplinkScheme` to your actual Despia scheme (default `myapp`). This is the only frontend value to change — `Login.jsx` reads it automatically.

### Step 4 — Register Deeplink in Despia

In your Despia project settings:
- **Scheme:** matches `appConfig.deeplinkScheme`
- **Allowed path:** `oauth/auth`

---

## Guided Walkthrough (with checkpoints)

Do these in order. After each step there's a **checkpoint** — a concrete thing you can verify before moving on. Skipping checkpoints is how people end up stuck for hours.

### 1. Prove the backend works before touching native

Deploy the auth functions and test **email/password first** — it has no Despia or Google moving parts, so it isolates the backend.

1. Register a test account through the app on the **web** (not in Despia).
2. Reload the page — you should stay logged in (the JWT is in `localStorage`, `authMe` re-validates it on boot).

> **Checkpoint:** you can register, log out, log back in, and refresh without being kicked to `/login`. If this fails, the problem is `JWT_SECRET` or `authMe` — fix it here, before adding Google or Despia.

### 2. Prove Google works on the web

On the web, `Login.jsx` takes the non-Despia branch. Sign in with Google in a normal browser tab.

> **Checkpoint:** Google web sign-in lands you in the app as an `Account`. If it fails with `redirect_uri_mismatch`, the redirect URI in Google Console doesn't *exactly* match `https://YOUR-APP.base44.app/native-callback.html` (no query string, no trailing slash).

### 3. Wrap in Despia and register the deep link

In Despia project settings, set your **scheme** (e.g. `myapp`) and allow the **path** `oauth/auth`. Rebuild the native app.

> **Checkpoint (isolate the deep link):** temporarily make a button fire `myapp://oauth/auth?token=test123`. If the app foregrounds and the WebView navigates with `token=test123` visible, deep links work. If nothing happens, the scheme/path isn't registered in Despia — nothing else will work until this does.

### 4. Run the full native Google flow

Now tap "Sign in with Google" inside the Despia app. Trace the flow from [Part 1](#part-1--native-google-sign-in-in-despia): in-app browser → Google → `native-callback.html` → deep link → `Auth.jsx` → `googleSignIn` → JWT.

> **Checkpoint:** you land in the app signed in, and a new `Account` appears in the database with the right email. If you're bounced to `/login` instantly, it's the boot-time capture issue — confirm `main.jsx` rewrites a token-bearing URL to `/auth` *before* React mounts (see [Boot-Time Token Capture](#critical-boot-time-token-capture)).

---

## Security Notes (don't skip)

This is real auth — treat it like it.

- **`JWT_SECRET` must be long and random** (32+ bytes). Anyone who has it can forge sessions for any user. Never commit it; keep it only in Base44 env vars.
- **The Google exchange happens server-side only.** `googleSignIn` trades the single-use code at Google's token endpoint using `GOOGLE_CLIENT_SECRET` — a leaked code is useless without the secret, and no Google access token ever reaches the frontend or a URL.
- **Verify the `id_token`'s `aud` (audience).** `googleSignIn` checks `aud === GOOGLE_CLIENT_ID`. Without it, a credential minted for a **different app** could forge a session in yours. Mandatory, not optional.
- **Use a verified Resend sender in production.** The default `onboarding@resend.dev` is Resend's sandbox and only delivers to your own Resend account email — set the `RESEND_FROM` secret to an address on a domain you verified in Resend, or reset emails silently never reach real users.
- **Passwords are PBKDF2-hashed** (100k iterations, per-user random salt) and compared **constant-time**, so timing can't leak how much of the hash matched. Plaintext passwords are never stored or logged.
- **Login errors are generic** ("Invalid email or password") so an attacker can't tell which emails have accounts (no user enumeration).
- **Password-reset responses are always generic success**, for the same reason — the email tells the real user; the response tells the attacker nothing.
- **Every protected backend function re-verifies the JWT.** The frontend gate (`ProtectedRoute`) is UX only — real enforcement is server-side, on each call.
- **Admin functions check `role === 'admin'` on the server**, not just in the UI. Hiding an admin button is not security.
- **Tokens expire (30 days here).** Shorten it if your app is sensitive; there's no server-side revocation with stateless JWTs, so expiry is your main lever (that, or rotating `JWT_SECRET`, which logs everyone out).

### Known tradeoffs (deferred by design)

These are acceptable for a template but worth hardening before a high-value production launch:

- ~~Implicit flow~~ **Resolved:** the app now uses the authorization code flow — tokens never travel through URLs; only a single-use code does. (PKCE could still be layered on top for defense-in-depth, but with the server-side client-secret exchange it adds little here.)
- **No app-level rate limiting** on `authLogin` / `authRequestReset`. If Base44 doesn't throttle at the platform edge, these are open to brute force / email flooding — add per-IP or per-email throttling before scaling.

---

## When NOT to Use This

Custom auth is more code to own. Skip it and use Base44's built-in `base44.auth` if **all** of these are true:

- You're only shipping a **web app** (or Base44's own mobile publishing), not a Despia WebView that needs native Google sign-in.
- Base44's read-only `User` entity + `updateMe` extras cover your user data — you don't need to create users programmatically or attach lots of custom fields.
- You're fine with Base44 owning the session lifetime and reset emails.

Reach for **this custom system** when you need native OAuth in Despia, full control over the user record, your own session/JWT rules, or your own admin tooling — i.e. the things the [comparison table](#why-this-beats-base44s-built-in-auth) marks ✅ only on the right.

---

## Teaching Cheat-Sheet (the 6 things people miss)

If you're explaining this to someone, these are the ideas that unlock it:

1. **Despia = WebView.** Normal OAuth redirects escape the WebView; that's the root problem.
2. **Code vs session.** Google auth code = one-time proof, exchanged server-side. Your JWT = the session. Trade one for the other on the backend.
3. **Deep links carry the code home.** `myapp://oauth/auth?code=...` is how the native shell hands the result back to the WebView.
4. **The JWT is the session** — a signed string your backend trusts because only it knows `JWT_SECRET`.
5. **Base44 is backend, not auth.** Functions + `Account` entity + Resend; `base44.auth` is never used for login.
6. **Verify server-side, always.** Google token verified with Google; JWT verified on every call; roles checked on the server.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` from Google | Redirect URI has query params or doesn't match | Register exactly `https://YOUR-APP.base44.app/native-callback.html` |
| Instantly bounced to `/login` after Google | Host collapsed `/oauth/auth?code=` to `/` before React mounted | Boot-time capture in `main.jsx` rewrites to `/auth` first |
| Stuck on "Signing you in…" spinner | Auth code not exchanged | `customAuth.loginWithGoogleCode()` → `googleSignIn` exchanges it with Google |
| `native-callback.html` 404 | File not in `public/` | Must be `public/native-callback.html` |
| Deeplink not firing on device | Scheme not registered in Despia | Add scheme + `oauth/auth` path in Despia settings |
| `Invalid or expired token` on every call | `JWT_SECRET` missing/changed | Set a stable `JWT_SECRET`; changing it invalidates all sessions |
| Works on web, not in Despia | `isDespia` UA check failing | Log `navigator.userAgent` on device — confirm it contains "despia" |

---

## What to Change Per Project

Everything per-project lives in exactly three spots (full checklist in [`/src/TEMPLATE_SETUP.md`](./src/TEMPLATE_SETUP.md)):

1. **`src/config/app-config.js`** → `deeplinkScheme` (the only frontend edit)
2. **Base44 secrets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_BASE_URL`
3. **External accounts:** Google Cloud Console redirect URI + Despia scheme/path

---

## Resources

- **despia-native npm:** https://www.npmjs.com/package/despia-native
- **Despia setup docs:** https://setup.despia.com
- **Despia website:** https://despia.com
- **Despia MCP server:** https://setup.despia.com/mcp
- **Despia llms.txt:** https://setup.despia.com/llms.txt