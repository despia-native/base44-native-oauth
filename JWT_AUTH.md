# Custom JWT Authentication — Setup & Best Practices

This app uses its **own** authentication system instead of Base44's built-in auth. We own the
user records (the `Account` entity), we hash passwords ourselves, and we issue and verify our
own **HS256 JSON Web Tokens (JWT)**. Base44 is used only for storage (entities), email, and
running the backend functions — it does **not** manage sessions here.

This document explains how the secrets work, how to set them up, how the whole flow fits
together, and the security best practices you must follow.

---

## 1. Why a custom auth system?

- **Full control over the user model.** All users live in the `Account` entity — email/password
  users, Google users, and anonymous native device accounts. We can add any field we want.
- **Native (Despia) compatibility.** The token lives in `localStorage` and is passed explicitly
  to backend functions, which works inside the native WebView where cookie-based redirects break.
- **Stateless sessions.** A signed JWT carries the account id, email, and role. Any backend
  function can verify it with the shared secret — no session table, no lookups just to authenticate.

---

## 2. The secrets

Auth depends on server-side secrets (environment variables on the backend functions). They are
**never** exposed to the frontend.

| Secret | Purpose | Required |
|---|---|---|
| `JWT_SECRET` | The signing key for our HS256 tokens. Every token is signed **and** verified with this exact value. | **Yes — critical** |
| `GOOGLE_CLIENT_ID` | Audience check — the Google `id_token` from the code exchange must be issued for *our* app. | For Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Exchanges the single-use OAuth authorization code at Google's token endpoint (server-side only). | For Google sign-in |
| `RESEND_API_KEY` | Sends the password-reset email. | For password reset |

### 2.1 `JWT_SECRET` — the most important one

The `JWT_SECRET` is the single key that secures every session. **Anyone who has it can forge a
valid token for any user, including admins.** Treat it like a master password.

**Requirements for a good secret:**

- At least **32 bytes** of high-entropy random data (longer is fine).
- Random — never a word, phrase, or anything guessable.
- Unique to this app — do not reuse it anywhere else.

**Generate one** with any of these:

```bash
# OpenSSL
openssl rand -base64 48

# Node
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Python
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 2.2 How to set the secrets

Secrets are set in the **Base44 dashboard → Settings → Environment Variables** (not in code, not
in the repo). Add each one with its exact name from the table above. Backend functions read them
at runtime with `Deno.env.get('JWT_SECRET')`.

> **Never** commit a secret to the repo, hardcode it in a function, or send it to the frontend.
> If you ever paste it into chat, a log, or a client file — rotate it immediately (see §6).

---

## 3. How the JWT is built and verified

We implement HS256 directly with Web Crypto (no external library) so it runs cleanly in Deno.

### Signing (on register / login / Google sign-in)

```
header  = { alg: "HS256", typ: "JWT" }
payload = { sub: <account id>, email, role, iat, exp }   // exp = 30 days out
data    = base64url(header) + "." + base64url(payload)
signature = HMAC-SHA256(data, JWT_SECRET)
token   = data + "." + base64url(signature)
```

The payload deliberately carries only non-sensitive claims: the account id (`sub`), email, and
role. No password, no secrets.

### Verifying (on every authenticated request)

`authMe` (and any protected function) does:

1. Split the token into `header.payload.signature`.
2. Recompute the HMAC over `header.payload` using `JWT_SECRET` and compare — this proves the
   token was issued by us and hasn't been tampered with.
3. Check `exp` — reject if expired.
4. Load the `Account` by `sub` to get the current, authoritative record (role, etc.).

If any step fails, the request is rejected with `401` and the frontend clears the stored token.

---

## 4. Password storage

Passwords are **never** stored in plain text and are **never** put in the JWT.

- Hashed with **PBKDF2-SHA256**, 100,000 iterations, a random 16-byte salt per user.
- Stored on the `Account` as `salt:hash` (hex).
- On login we re-derive the hash from the submitted password and compare using a
  **constant-time** comparison to avoid timing attacks.
- Minimum length is enforced at registration (8 characters).

Google-only and anonymous device accounts have an empty `password_hash` and can't log in with a
password — that's expected.

---

## 5. The end-to-end flow

```
Frontend (src/lib/customAuth.js)          Backend functions            Storage
─────────────────────────────────────────────────────────────────────────────
register / login  ─────────────────────▶  authRegister / authLogin
                                           - hash / verify password  ─▶ Account entity
                                           - sign JWT (JWT_SECRET)
        ◀───────────── { token, account } ─┘
setToken(token)  →  localStorage["app_auth_token"]

every load / resume  ──── token ────────▶  authMe
                                           - verify JWT (JWT_SECRET)
                                           - load Account by sub    ◀─▶ Account entity
        ◀──────────────────── { account } ─┘

logout  →  clearToken()   (stateless — nothing to revoke server-side)
```

- **Token storage:** `localStorage` key `app_auth_token`.
- **Token transport:** passed explicitly in the function payload / `x-app-token` header — not a cookie.
- **Session length:** 30 days (`exp` in the signed payload).

---

## 6. Best practices & operational rules

**Secret hygiene**
- Keep `JWT_SECRET` only in the dashboard environment variables. Never in code, logs, or the client.
- Use a long, random value (§2.1). Don't reuse it across environments or apps.

**Rotating `JWT_SECRET`**
- Changing it **immediately invalidates every existing token** — all users are signed out and must
  log in again. That's the point during an incident, but do it intentionally.
- Rotate right away if the secret may have leaked.

**Authorization**
- Never trust the `role` claim in the token alone for sensitive actions — the token is only as
  fresh as its `exp`. For admin-only operations, verify the role against the loaded `Account`
  (which `authMe` already does) and enforce `role === 'admin'` server-side in the function.
- Do all authorization checks on the backend. The frontend guard (`ProtectedRoute`) is UX only.

**Tokens**
- Keep payloads minimal and non-sensitive — the payload is base64, **not encrypted**; anyone can
  read it. Only the signature is protected.
- Keep expiry reasonable. Longer = better UX but a longer window if a token leaks.

**Transport**
- Only ever call the auth functions over HTTPS (Base44 endpoints already are).

**Do not**
- Do not store passwords or secrets in the token.
- Do not verify tokens on the frontend — verification requires `JWT_SECRET`, which must stay server-side.
- Do not skip the `Account` lookup and trust the token's `role`/`email` blindly for privileged flows.

---

## 7. Where things live

| Concern | File |
|---|---|
| Frontend session client (token storage, login/register/logout) | `src/lib/customAuth.js` |
| Auth state / React context | `src/lib/AuthContext.jsx` |
| Route guard | `src/components/ProtectedRoute.jsx` |
| Register (hash password, sign JWT) | `base44/functions/authRegister/entry.ts` |
| Login (verify password, sign JWT) | `base44/functions/authLogin/entry.ts` |
| Verify token / current user | `base44/functions/authMe/entry.ts` |
| Google sign-in exchange | `base44/functions/googleSignIn/entry.ts` |
| Password reset request / apply | `base44/functions/authRequestReset`, `authResetPassword` |
| Anonymous native device login | `base44/functions/deviceSignIn/entry.ts` |
| User model | `Account` entity |

---

## 8. Quick setup checklist

- [ ] Generate a strong random value and set **`JWT_SECRET`** in dashboard → Settings → Environment Variables.
- [ ] Set **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`** if using Google sign-in.
- [ ] Set **`RESEND_API_KEY`** if using password reset emails.
- [ ] Confirm none of these are committed to the repo or referenced on the frontend.
- [ ] Test: register → the returned token verifies via `authMe` and the user stays signed in on reload.