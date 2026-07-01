# Native Google OAuth + Custom Auth — Base44 + Despia

> ⚠️ **This file is a pointer.** The full, up-to-date documentation lives at the
> project root: [`/DESPIA_OAUTH.md`](../DESPIA_OAUTH.md).
>
> An older version of this file described a different approach (Base44 built-in
> tokens via `sso.getAccessToken` + `inviteUser`). **That is not what this app does.**
> This app runs a fully custom auth system on top of Base44's backend.

---

## What This App Actually Does (summary)

- **Users live in a custom `Account` entity** you fully own (CRUD, custom fields, analytics).
- **Sessions are your own HS256 JWTs**, signed by backend functions with `JWT_SECRET`.
- **Base44's built-in auth (`base44.auth`) is not used for login** — Base44 provides only the serverless backend, database, and email.
- **Native Google Sign-In works in Despia** via the `oauth://` bridge → `native-callback.html` → deeplink → `Auth.jsx` → `googleSignIn` backend → our JWT.

### The moving parts

| Layer | Files |
|---|---|
| Frontend session | `src/lib/customAuth.js`, `src/lib/AuthContext.jsx`, `src/components/ProtectedRoute.jsx` |
| OAuth capture | `src/main.jsx` (boot-time token capture), `src/lib/deeplinkToken.js`, `src/pages/Auth.jsx`, `public/native-callback.html` |
| Auth pages | `src/pages/Login.jsx`, `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx` |
| Admin | `src/pages/AdminUsers.jsx` |
| Backend | `base44/functions/authRegister`, `authLogin`, `googleSignIn`, `authMe`, `authRequestReset`, `authResetPassword`, `googleAuthUrl`, `adminUsers` |

### Why custom instead of Base44's built-in auth

Base44's built-in auth can't create users programmatically, can't fully control the `User` record, and its redirect flow breaks in a native WebView. The custom system fixes all of that (own `Account` entity, own JWTs, native `oauth://` bridge) **while still running entirely on Base44's backend**.

👉 **See [`/DESPIA_OAUTH.md`](../DESPIA_OAUTH.md) for the complete guide**, including the architecture diagram, per-function breakdown, setup checklist, and troubleshooting.