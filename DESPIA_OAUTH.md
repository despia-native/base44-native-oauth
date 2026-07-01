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
│  googleSignIn      verify Google token → find/create → JWT   │
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
   https://your-app.base44.app/native-callback.html#access_token=ya29...&state=myapp
        │
        ▼
native-callback.html reads the token + scheme, shows "Continue to app",
fires the deeplink:  myapp://oauth/auth?token=ya29...
        │
        ▼
Despia intercepts the deeplink → WebView navigates to /oauth/auth?token=ya29...
        │
        ▼
Auth.jsx → customAuth.loginWithGoogleToken(googleToken)
        │  → backend googleSignIn: verifies the Google token with Google,
        │    finds/creates the Account, returns OUR OWN JWT
        ▼
✅ JWT stored in localStorage, AuthContext refreshed, user enters the app
```

> **Key insight:** Google's implicit flow returns a **Google** access token. That's not a session — we send it to our `googleSignIn` backend function, which verifies it with Google, finds or creates the `Account`, and issues **our own JWT**. That JWT is the real session.

### Critical: Redirect URI Must Be Clean (No Query Params)

Google requires the redirect URI to **exactly match** what's registered in Google Cloud Console — including any query string.

- ✅ **Correct:** register `https://your-app.base44.app/native-callback.html` (no query string), and pass the deeplink scheme via the OAuth `state` param. Google returns `state` in the hash, so the callback page can read it alongside the token.
- ❌ **Wrong:** `...native-callback.html?deeplink_scheme=myapp` — forces you to register that exact query string; fragile and breaks if the scheme changes.

### Critical: Boot-Time Token Capture

The static host may collapse a deep-linked path like `/oauth/auth?token=...` down to `/` **before React mounts**. If that happens, the protected-root guard fires and bounces the user to `/login` before the token is ever read.

**Fix (in `main.jsx`):** before React mounts, check for a token anywhere in the URL. If one is present, stash it in `sessionStorage` and rewrite the URL to `/auth` (a public route). Now the guard can never intercept a token-bearing visit. `Auth.jsx` then consumes the stashed token (or reads it live, since the native WebView can swap the URL without reloading).

### Why `response_type=token` (Implicit Flow)

`native-callback.html` is a **fully static** file — no server, no backend calls. Google must return the token directly in the URL hash (`#access_token=...`), which is what `response_type=token` does; `state` (your deeplink scheme) comes back in the hash too. `response_type=code` would return a code the static page can't exchange. **Do not change `response_type`.**

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
| `googleSignIn` | Verify Google token with Google → find/create `Account` → return JWT |
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
| `src/lib/deeplinkToken.js` | Captures/stashes the OAuth token at boot |
| `src/pages/Login.jsx` | Email/pw + Google (native vs web branch) |
| `src/pages/Auth.jsx` | Consumes the Google token, exchanges it for our JWT |
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

### Step 3 — Deeplink Scheme

In `src/pages/Login.jsx`, use your actual Despia scheme in place of `myapp`.

### Step 4 — Register Deeplink in Despia

In your Despia project settings:
- **Scheme:** `myapp` (or yours)
- **Allowed path:** `oauth/auth`

### Step 5 — App URL

In `base44/functions/googleAuthUrl/entry.ts`, set `APP_BASE_URL` to your app's public Base44 URL.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` from Google | Redirect URI has query params or doesn't match | Register exactly `https://YOUR-APP.base44.app/native-callback.html` |
| Instantly bounced to `/login` after Google | Host collapsed `/oauth/auth?token=` to `/` before React mounted | Boot-time token capture in `main.jsx` rewrites to `/auth` first |
| Stuck on "Signing you in…" spinner | Google token not exchanged | Call `customAuth.loginWithGoogleToken()` → `googleSignIn` backend |
| `native-callback.html` 404 | File not in `public/` | Must be `public/native-callback.html` |
| Deeplink not firing on device | Scheme not registered in Despia | Add scheme + `oauth/auth` path in Despia settings |
| `Invalid or expired token` on every call | `JWT_SECRET` missing/changed | Set a stable `JWT_SECRET`; changing it invalidates all sessions |
| Works on web, not in Despia | `isDespia` UA check failing | Log `navigator.userAgent` on device — confirm it contains "despia" |

---

## What to Change Per Project

1. `base44/functions/googleAuthUrl/entry.ts` → `APP_BASE_URL`
2. `src/pages/Login.jsx` → Despia deeplink scheme (`myapp`)
3. Base44 secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `RESEND_API_KEY`

---

## Resources

- **despia-native npm:** https://www.npmjs.com/package/despia-native
- **Despia setup docs:** https://setup.despia.com
- **Despia website:** https://despia.com
- **Despia MCP server:** https://setup.despia.com/mcp
- **Despia llms.txt:** https://setup.despia.com/llms.txt