# Sign In with Apple — Full Setup Guide

Complete, step-by-step guide for configuring Sign In with Apple in this template.
Covers the Apple Developer Console, the app secrets, the config files, and how
every flow works (iOS, Android, web, account linking, re-auth for deletion).

> **Time required:** ~15 minutes. **Prerequisite:** a paid Apple Developer account.

---

## 1. How it works (architecture)

This template uses the **OpenID Connect `id_token` flow** — no `.p8` client
secret is needed for login. The backend verifies the token's RS256 signature
against Apple's public JWKS (`https://appleid.apple.com/auth/keys`) and checks
the `iss` / `aud` / `exp` claims. All sessions are our own HS256 JWTs signed
with `JWT_SECRET` — Apple is only used to prove identity.

| Platform | Flow |
|---|---|
| **iOS (Despia)** | Apple JS SDK popup → native Face ID sheet → `id_token` returned in-page → `appleSignIn` function → our JWT |
| **Web** | Apple JS SDK popup (browser window) → same as iOS |
| **Android (Despia)** | No native sheet exists → `appleAuthUrl` builds an Apple URL → Chrome Custom Tabs (`oauth://` bridge) → Apple redirects to `native-callback.html` → deeplink back into the app → `/auth` page exchanges the `id_token` |

Files involved:

| File | Role |
|---|---|
| `src/lib/appleAuth.js` | Platform detection + triggers the right flow |
| `src/config/app-config.js` | `appleServicesId` + deeplink scheme (frontend) |
| `base44/functions/appleSignIn/entry.ts` | Verifies `id_token`, finds/creates the Account, issues our JWT |
| `base44/functions/appleAuthUrl/entry.ts` | Builds the Apple authorize URL (Android flow) |
| `base44/functions/authLinkAccount/entry.ts` | Links an Apple identity to an anonymous guest account (merges if it already exists) |
| `base44/functions/authReauth/entry.ts` | Re-verifies the Apple identity before account deletion |
| `public/native-callback.html` | Relay page: catches Apple's redirect, deeplinks the token back into the native app |
| `src/pages/Auth.jsx` | Handles the deeplinked token (sign-in, link mode, re-auth-delete mode) |
| `index.html` | Loads the Apple JS SDK (`appleid.auth.js`) |

---

## 2. Apple Developer Console setup

### Step 2.1 — App ID (your native app)

1. Go to **developer.apple.com → Certificates, Identifiers & Profiles → Identifiers**.
2. Open (or create) the **App ID** for your iOS app, e.g. `com.yourcompany.yourapp`.
3. Under **Capabilities**, enable **Sign In with Apple** → Save.

### Step 2.2 — Services ID (the "client id" used by this app)

1. **Identifiers → + → Services IDs → Continue.**
2. Description: your app name. Identifier: e.g. `com.yourcompany.yourapp.webauth`
   (this project uses `com.despia.myapp.appleauth`).
   👉 **This exact string is your `APPLE_SERVICES_ID`.**
3. Register it, then open it and check **Sign In with Apple** → **Configure**:
   - **Primary App ID:** the App ID from Step 2.1.
   - **Domains and Subdomains:**
     ```
     despia-connect-go.base44.app
     ```
   - **Return URLs** (comma-delimited, `https://` required, no wildcards):
     ```
     https://despia-connect-go.base44.app/,https://despia-connect-go.base44.app/native-callback.html
     ```
     - `…/` → used by the Apple JS SDK popup (iOS + web).
     - `…/native-callback.html` → used by the Android Chrome Custom Tabs flow.
4. Click **Done → Continue → Save**.

> **Custom domain?** If you publish the app on your own domain later, come back
> and ADD that domain plus the same two return URLs for it (keep the base44 ones too).

### Step 2.3 — `.p8` key (NOT needed for login)

You do **not** need to create a "Sign In with Apple" private key (`.p8`) for
this template's login flow. It would only be required later for server-to-server
calls such as token revocation. Skip it for now.

---

## 3. App secrets (Dashboard → Settings → Environment Variables)

| Secret | Value | Required |
|---|---|---|
| `APPLE_SERVICES_ID` | The Services ID from Step 2.2 (e.g. `com.yourcompany.yourapp.webauth`) | ✅ Yes |
| `APP_BASE_URL` | Your app's public URL, e.g. `https://despia-connect-go.base44.app` (no trailing slash) | Recommended (Android flow falls back to the template default otherwise) |
| `JWT_SECRET` | ≥32 random characters — already set for this template's auth | ✅ Yes (already set) |

---

## 4. Frontend config — the client-side ID swap (⚠️ most common mistake)

**Backend secrets NEVER reach the frontend.** Setting the `APPLE_SERVICES_ID`
secret in the dashboard configures only the backend functions — the Apple JS
SDK popup runs in the browser and cannot read secrets. The Services ID must
therefore ALSO be set as a plain constant in `src/config/app-config.js`:

```js
appleServicesId: 'com.despia.myapp.appleauth',  // ← this project's Services ID
```

This is safe: a Services ID is a **public client id** (like a Google OAuth
client id), not a secret — it's visible in the popup URL anyway.

The same value must live in TWO places, kept identical:

| Where | Used by | If wrong |
|---|---|---|
| `src/config/app-config.js` → `appleServicesId` | Apple JS SDK popup (iOS/web) | `invalid_client` in the Apple popup |
| `APPLE_SERVICES_ID` secret (dashboard) | `appleSignIn` / `appleAuthUrl` / `authLinkAccount` / `authReauth` token verification | "Token not issued for this app" (401) AFTER a successful popup |

The Apple JS SDK is already loaded in `index.html`:

```html
<script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"></script>
```

---

## 5. Despia (native shell) setup

- **iOS:** enable the **Sign In with Apple** capability for your app in the
  Despia dashboard (it must match the App ID from Step 2.1).
- **Android:** nothing Apple-specific — the flow rides on the existing
  `oauth://` Chrome Custom Tabs bridge and your deeplink scheme
  (`appConfig.deeplinkScheme` in `src/config/app-config.js`).

---

## 6. The flows in detail

### 6.1 Sign in (Login page → "Continue with Apple")

- **iOS/web:** `signInWithApple()` opens the Apple popup, gets `id_token` (+ the
  user's name on the **first sign-in only** — Apple never sends it again), then
  calls the `appleSignIn` function which verifies the token and returns our JWT.
- **Android:** `signInWithApple()` calls `appleAuthUrl`, opens Chrome Custom
  Tabs. Apple redirects to `native-callback.html`, which deeplinks
  `scheme://oauth/auth?id_token=…` back into the WebView. `/auth` picks it up
  and calls `appleSignIn`.

Account matching in `appleSignIn`: lookup by `apple_id` (Apple `sub`) first,
then by email — so an existing email account gets Apple linked to it instead of
creating a duplicate. New accounts get `email_verified` from Apple's claim.

**Hide My Email** is fully supported — the private relay address
(`…@privaterelay.appleid.com`) is stored as the account email.

### 6.2 Linking a guest account (Account → "Protect Your Account" → "Link with Apple")

`authLinkAccount` attaches the Apple identity to the CURRENT anonymous device
account so all guest data is preserved. If the Apple identity (or its
Apple-verified email) already belongs to another account, the guest account is
**merged into it**: the device binding moves over, the anonymous account is
deleted, and the user is signed into the existing account.

- iOS/web: linked directly from the popup result.
- Android: an `apple_link_mode` flag is set before the deeplink round-trip so
  `/auth` links instead of signing in fresh.

### 6.3 Re-auth before account deletion

Apple-only accounts confirm deletion by re-authenticating with Apple
(`authReauth` verifies the returned `id_token` belongs to the same account).
The Android flow uses the same deeplink path with a re-auth flag.

---

## 7. Testing checklist

1. **Web preview:** Login page → "Continue with Apple" → popup → you land on Home.
2. **iOS build:** same button → native Face ID sheet appears.
3. **Android build:** same button → Chrome Custom Tab → returns to the app on `/auth` → signed in.
4. **Linking:** as a guest, Account → Protect Your Account → "Link with Apple" → data preserved, email shows on the account.
5. **First-run name:** delete the test user at appleid.apple.com → *Sign in with Apple* → your app, then sign in again to re-test name capture.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `invalid_client` in the Apple popup | `appleServicesId` in `app-config.js` is still the template placeholder (setting the SECRET is not enough — see §4), doesn't exist, isn't a **Services ID** (App IDs don't work), or Sign In with Apple isn't configured on it |
| `invalid_request: Invalid web redirect url` | The current origin (or `native-callback.html`) isn't registered as a Return URL in Step 2.2 — register the **exact** URL including `https://` and the trailing `/` for the root. Note: the Base44 **editor preview** runs on a different origin and will always fail — test on the published URL |
| "Token not issued for this app" (401 from backend) | `APPLE_SERVICES_ID` secret ≠ the `clientId` the frontend used — make them identical |
| "Apple sign-in is unavailable" | Apple JS SDK script missing/blocked in `index.html` |
| Android: stuck on "Signing you in…" | Deeplink scheme mismatch — `appConfig.deeplinkScheme` must match the scheme configured in Despia |
| Name is empty | Apple only sends the name on the very first authorization — revoke the app at appleid.apple.com and sign in again |
| Email looks like `…@privaterelay.appleid.com` | User chose "Hide My Email" — this is expected and works normally |
| Email looks like `apple-…@apple.local` | Apple didn't return an email (rare; usually a re-auth without the email scope) — a synthetic placeholder is stored |