# Why Google Login Required a Custom Auth System on Base44

Technical breakdown of the Base44 platform API limitations that forced this app to
implement its own Google login flow and JWT-based session system, instead of using
Base44's built-in authentication.

> Context: this app ships as a **native mobile app via Despia** (a native shell
> around a WebView). Everything below follows from that.

---

## 1. What Base44's SDK actually exposes for Google login

The client SDK (`@base44/sdk`) provides exactly one Google entry point:

```js
base44.auth.loginWithProvider("google", fromUrl)
```

Its behavior is hard-wired: it performs a **full-page browser redirect** to Base44's
hosted OAuth broker, which then redirects to `accounts.google.com/o/oauth2/v2/auth`
using **Base44's own Google OAuth client**, receives the callback on **Base44's own
domain**, creates a session server-side, and finally redirects the browser back to
`fromUrl` with the session established in browser storage.

Every parameter of that OAuth transaction is fixed by the platform:

- **`client_id`** — Base44's, not ours. No control over the Google Cloud project,
  brand, or consent screen.
- **`redirect_uri`** — Base44's callback URL. Not configurable. This is the fatal
  one (see §2).
- **Flow shape** — the entire code exchange happens inside Base44's backend; the
  client never sees a Google `access_token`, `id_token`, or authorization `code`.

There is no lower-level primitive. The SDK has `setToken(access_token)` — but the
only sources of a valid `access_token` are Base44's own flows (e.g. `verifyOtp()`
returns one). There is **no API that accepts a Google credential and returns a
Base44 token**.

---

## 2. The `redirect_uri` limitation × Google's WebView ban

Google's OAuth policy rejects requests from embedded WebView user-agents with
**`Error 403: disallowed_useragent`**. A Despia app *is* a WebView. The compliant
pattern for native apps is:

1. Open the **system browser** (Despia's `oauth://` command) for the Google consent
   screen.
2. Google redirects to a callback that ultimately fires a **custom-scheme deep
   link** (`app.scheme://oauth/auth?code=...`) to re-enter the app.

Base44's flow cannot participate in step 2:

- Its `redirect_uri` is locked to its own domain.
- It terminates by setting a session **in the browser that ran the flow** —
  Safari/Chrome — a completely separate cookie jar and localStorage from the app's
  WebView. The session physically cannot cross that boundary.
- There is no `auth.exportSession()`, no one-time-code handoff, and no configurable
  post-login deep link.

---

## 3. No credential-exchange endpoint (the industry-standard escape hatch)

Every major BaaS solves the native problem with a token-exchange API:

| Platform | API |
|---|---|
| Firebase | `signInWithCredential(GoogleAuthProvider.credential(idToken))`, `createCustomToken(uid)` |
| Supabase | `auth.signInWithIdToken({ provider: 'google', token })` |
| Auth0 | `/oauth/token` with token-exchange grants |
| **Base44** | **— none —** |

Even after we run Google OAuth ourselves and hold a **verified** Google token in
the app, there is no Base44 endpoint — REST or SDK — to convert it into a platform
session. Dead end by design.

---

## 4. No programmatic user provisioning

First-time Google sign-in must create a user. Against the built-in `User` entity:

- `base44.entities.User.create(...)` → **HTTP 405 Method Not Allowed** — also from
  service-role backend code, and via data import.
- The only creation path is `base44.users.inviteUser(email, role)`, which sends an
  **email invitation** the person must accept through Base44's hosted signup —
  asynchronous, email-dependent, and it lands them in the hosted flow we can't use
  anyway (§2).

**Consequence:** we maintain our own `Account` entity (with `google_id` = Google's
`sub` claim, plus `email`, `avatar_url`, `role`, `last_login_at`, …) which backend
functions can create and update freely via `asServiceRole`.

---

## 5. No session-minting / impersonation API

Even for an *existing* user there is no server-side `createSessionFor(userId)`, no
admin token issuance, and no refresh-token API. `createClientFromRequest(req)` in
backend functions only **validates** platform tokens issued by the hosted flow — it
never creates them. "We verified this Google identity server-side, now log them in"
is unexpressible in platform APIs.

---

## 6. Knock-on effect: the data layer must be abstracted behind our own APIs

Because our users hold **our** JWT (HS256, signed with `JWT_SECRET`, `sub` =
Account id, `exp` enforced) rather than a platform token:

- `base44.auth.me()` and user-scoped `base44.entities.X.*` calls from the frontend
  are unusable — the platform sees no session.
- Every operation is a backend function (`authMe`, `adminUsers`, `sendPush`, …)
  that:
  1. verifies the JWT signature with WebCrypto (`SubtleCrypto` HMAC verify),
  2. checks `exp`,
  3. loads the matching `Account` record,
  4. enforces authorization in code (e.g. `role === 'admin'`),
  5. then reads/writes via `base44.asServiceRole.entities.*`.
- Platform row-level security no longer applies — authorization lives entirely in
  our function code.

---

## 7. What we built (the flow, end to end)

1. **`googleAuthUrl`** — builds `https://accounts.google.com/o/oauth2/v2/auth` with
   our own `GOOGLE_CLIENT_ID`, with a `redirect_uri` that lands on our callback and
   fires the Despia deep-link scheme back into the app.
2. The system browser completes consent; the deep link delivers a **single-use
   authorization code** (`response_type=code`) to the in-app `/auth` page (with
   event-listener + polling handling, since the WebView receives it as a
   URL/history change). No Google access token ever appears in any URL.
3. **`googleSignIn`** — exchanges the code server-side at
   `https://oauth2.googleapis.com/token` using `GOOGLE_CLIENT_SECRET`, reads the
   verified identity from the returned `id_token`, checks that `aud` equals our
   client ID (prevents token-substitution attacks), find-or-creates the `Account`
   by `google_id`/email, updates `last_login_at`, then signs and returns our JWT.
4. The client stores the JWT in localStorage **and** the Despia secure vault
   (iOS Keychain) — surviving WebView storage purges and enabling Face ID re-entry.
   Platform sessions support neither (cookie/browser-storage bound, no export API).

---

## 8. Summary table

| Needed for native Google login | Base44 API | Status |
|---|---|---|
| Custom OAuth `redirect_uri` (deep link) | — | ❌ locked to platform callback |
| Exchange Google token → session | — | ❌ no endpoint exists |
| Create user programmatically | `User.create` | ❌ 405; invite-only |
| Mint session for a known user | — | ❌ no API |
| Session in Keychain / secure vault | — | ❌ browser storage only |
| Verify our own JWT in backend | `createClientFromRequest` | ⚠️ platform tokens only → we verify manually |
| Privileged DB access behind our checks | `asServiceRole` | ✅ this is what makes the workaround possible |

**Bottom line:** Base44's Google auth is a sealed, browser-bound, hosted flow with
zero extension points at every layer a native app needs — redirect control, token
exchange, user provisioning, session minting, secure storage. The one platform
capability that *is* open — service-role backend functions — is exactly where we
rebuilt the auth stack.

**Trade-off:** we own security-sensitive code (JWT signing/verification, password
hashing, per-endpoint permission checks) that the platform would otherwise manage.
That is the cost of native Google login, guest accounts, Apple sign-in, and
Keychain-persisted sessions.

---

*Related docs: `JWT_AUTH.md` (token flow details), `DESPIA_OAUTH.md` (deep-link
mechanics), `PUSH_NOTIFICATIONS.md`.*