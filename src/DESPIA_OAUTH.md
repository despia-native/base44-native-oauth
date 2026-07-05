# Native Google OAuth + Custom Auth — Base44 + Despia

> **This file is a pointer.** The full documentation lives at the project root: [`/DESPIA_OAUTH.md`](../DESPIA_OAUTH.md).

---

## What This App Actually Does (summary)

- **Users live in a custom `Account` entity** you fully own (CRUD, custom fields, analytics).
- **Sessions are your own HS256 JWTs**, signed by backend functions with `JWT_SECRET`.
- **Base44's built-in auth (`base44.auth`) is not used for login** — Base44 provides only the serverless backend, database, and email.
- **Native Google Sign-In works in Despia** via the `oauth://` bridge → `native-callback.html` (single-use auth code) → deeplink → `Auth.jsx` → `googleSignIn` backend (code exchange with Google, server-side) → our JWT.

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

### The full guide covers

👉 **[`/DESPIA_OAUTH.md`](../DESPIA_OAUTH.md)** — the complete teaching guide:

- **The mental model** — why a WebView breaks normal OAuth, the two-token concept, what a JWT session actually is, and why Base44 is your backend (not your auth).
- **How Despia + Base44 fit together** — who owns which layer (transport vs. compute vs. identity).
- **Part 1 — native Google sign-in in Despia** — full flow, clean redirect URI, boot-time code capture, why the authorization code flow.
- **Part 2 — the custom auth system** — `Account` data model, JWT sessions, PBKDF2 passwords, every backend function.
- **Guided walkthrough with checkpoints** — prove each layer works before adding the next.
- **Security notes**, **when NOT to use this**, a **teaching cheat-sheet**, troubleshooting table, and per-project changes.