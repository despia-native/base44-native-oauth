# 🧩 Template Setup — Make This App Your Own

This project is a **working template** for a fully custom auth system (native Google Sign-In in Despia + your own JWT sessions on Base44). It runs as-is; to make it *yours*, swap the values below.

> Read [`/DESPIA_OAUTH.md`](./DESPIA_OAUTH.md) for the full mental model and how everything fits together. **This file is just the checklist of what to change.**

---

## The 3 places you edit — nothing else is hardcoded

| # | What | Where | Change to |
|---|---|---|---|
| 1 | **Frontend config** (deep-link scheme) | `src/config/app-config.js` | Your Despia scheme |
| 2 | **Secrets** (Google, JWT, email, app URL) | Base44 Dashboard → Settings → Environment Variables | Your own values |
| 3 | **External accounts** (Google Console + Despia settings) | Google Cloud Console, Despia project | Register your URLs/scheme |

That's it. All per-project values live in these three spots — no scattered constants to hunt for.

---

## Step 1 — Frontend config (`src/config/app-config.js`)

One file holds every frontend setting:

```js
export const appConfig = {
  deeplinkScheme: 'myapp',      // ← your Despia scheme (no "://")
  deeplinkPath: 'oauth/auth',   // ← usually leave as-is
}
```

Set `deeplinkScheme` to your app's scheme. `Login.jsx` reads this automatically — you don't touch any page code.

> If you change `deeplinkPath`, also update the `/oauth/auth` route in `src/App.jsx` and the "Allowed path" in Despia. Most projects leave it alone.

---

## Step 2 — Secrets (Base44 → Settings → Environment Variables)

Set each of these. They are **secrets**, not code — so they never live in the repo and don't get overwritten when you edit files.

| Secret | What it is | Where to get it |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console → Credentials |
| `JWT_SECRET` | Long random string that signs your sessions | Generate one (32+ random chars). **Keep it stable** — changing it logs everyone out |
| `RESEND_API_KEY` | For password-reset emails | [resend.com](https://resend.com) → API Keys |
| `APP_BASE_URL` | Your app's public Base44 URL, e.g. `https://YOUR-APP.base44.app` | Your Base44 app URL (no trailing slash) |

> ⚠️ `APP_BASE_URL` **must exactly match** the domain you register in Google Console (Step 3). If it's wrong, Google sign-in fails with `redirect_uri_mismatch`. The code falls back to a demo URL if unset — always set your own.

---

## Step 3 — External accounts

### Google Cloud Console
1. **APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application**
2. **Authorized redirect URIs** → add **exactly** (no trailing slash, no query string):
   ```
   https://YOUR-APP.base44.app/native-callback.html
   ```
   This must match your `APP_BASE_URL` + `/native-callback.html`.
3. Copy the Client ID / Secret into the secrets above.

### Despia project settings
- **Scheme:** the same value as `appConfig.deeplinkScheme` (e.g. `myapp`)
- **Allowed path:** `oauth/auth` (matches `appConfig.deeplinkPath`)

---

## ✅ Final checklist

- [ ] `src/config/app-config.js` → `deeplinkScheme` is your scheme
- [ ] `GOOGLE_CLIENT_ID` secret set
- [ ] `GOOGLE_CLIENT_SECRET` secret set
- [ ] `JWT_SECRET` secret set (long, random, stable)
- [ ] `RESEND_API_KEY` secret set
- [ ] `APP_BASE_URL` secret set to your app URL (no trailing slash)
- [ ] Google Console redirect URI = `APP_BASE_URL` + `/native-callback.html`
- [ ] Despia scheme + `oauth/auth` path registered

When all boxes are checked, follow the **Guided Walkthrough** in [`/DESPIA_OAUTH.md`](./DESPIA_OAUTH.md#guided-walkthrough-with-checkpoints) to verify each layer.

---

## Why these aren't just constants in code

The sensitive values (`GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `RESEND_API_KEY`, `APP_BASE_URL`) live in **Base44 secrets**, not in the source, so:
- They're never committed or exposed to the browser.
- Editing app code can't accidentally overwrite them.
- Swapping projects = change secrets in the dashboard, no code edit.

Only the **non-secret** deep-link scheme lives in code (`app-config.js`), because the frontend needs it at build time and it's not sensitive.