# Native Google OAuth in Base44 Apps with Despia

This document explains how native Google OAuth login works in this template, and how to configure it for your own app when using [Despia](https://despia.com) to wrap a Base44 web app into a native mobile app.

---

## How It Works

Standard browser OAuth redirects don't work inside a native WebView — the redirect lands in the external browser and never returns to the app. Despia solves this with its `oauth://` bridge:

1. The app calls `despia('oauth://?url=...')` with the Google OAuth URL.
2. Despia opens the URL in a **secure in-app browser** (SFSafariViewController / Chrome Custom Tab).
3. After the user signs in, Google redirects to your app's **`/native-callback.html`** page.
4. `native-callback.html` reads the token from the URL hash and redirects to a **custom deeplink** (`myapp://oauth/auth?access_token=...`).
5. Despia intercepts the deeplink and routes it back into the WebView as a navigation to `/auth?access_token=...`.
6. The `/auth` page calls `base44.auth.setToken(accessToken)` and redirects to the home screen.

---

## Flow Diagram

```
User taps "Sign in with Google"
        │
        ▼
Login.jsx calls base44.functions.invoke('googleAuthUrl')
        │
        ▼
Base44 backend function builds Google OAuth URL
(using GOOGLE_CLIENT_ID secret)
        │
        ▼
despia('oauth://?url=<google-oauth-url>')
        │
        ▼
Despia opens secure in-app browser → Google Sign-In
        │
        ▼
Google redirects to:
https://your-app.base44.app/native-callback.html
  ?deeplink_scheme=myapp
  #access_token=ya29...
        │
        ▼
native-callback.html reads token from hash,
redirects to: myapp://oauth/auth?access_token=ya29...
        │
        ▼
Despia intercepts deeplink → navigates WebView to:
/auth?access_token=ya29...
        │
        ▼
Auth.jsx calls base44.auth.setToken(accessToken)
        │
        ▼
✅ User is logged in, redirect to /
```

---

## Setup Checklist for Template Users

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application type).
3. Under **Authorized redirect URIs**, add:
   ```
   https://YOUR-APP.base44.app/native-callback.html
   ```
   Replace `YOUR-APP` with your actual Base44 app subdomain.
4. Copy your **Client ID** and **Client Secret**.

### 2. Base44 Secrets

In the Base44 dashboard → **Settings** → **Environment Variables**, set:

| Secret | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |

### 3. Update the Frontend Constant

In `src/pages/Login.jsx`, update the `GOOGLE_CLIENT_ID` constant at the top of the file:

```js
// TODO: Replace with your own Google OAuth Client ID
const GOOGLE_CLIENT_ID = 'YOUR-CLIENT-ID.apps.googleusercontent.com'
```

> This constant is used as a fallback for web (non-Despia) environments. The backend function uses the secret value for native flows.

### 4. Update Your Deeplink Scheme

If your Despia app uses a different deeplink scheme than `myapp`, update it in two places:

**`src/pages/Login.jsx`** — in the `handleGoogleSignIn` function:
```js
base44.functions.invoke('googleAuthUrl', { deeplink_scheme: 'YOUR-SCHEME' })
```

**`public/native-callback.html`** — the `deeplink_scheme` query param passed by the backend will match automatically.

### 5. Configure Despia

In your Despia app settings, register the deeplink scheme (e.g. `myapp`) and ensure `myapp://oauth/auth` is an allowed deeplink route.

---

## File Reference

| File | Purpose |
|---|---|
| `src/pages/Login.jsx` | Login UI; detects Despia env and triggers OAuth |
| `src/pages/Auth.jsx` | Receives token from deeplink/redirect, calls `setToken` |
| `public/native-callback.html` | Static page that bridges Google's redirect to the deeplink |
| `base44/functions/googleAuthUrl/entry.ts` | Backend function that builds the Google OAuth URL |

---

## Web (Non-Despia) Fallback

When running in a standard browser (not inside Despia), `Login.jsx` falls back to Base44's built-in `loginWithProvider('google', ...)` which handles the OAuth redirect flow natively through Base44's auth system. No extra configuration needed for the web flow.

---

## Security Notes

- The **Client Secret** is only used server-side in the Base44 backend function — it is never exposed to the frontend.
- The **Client ID** is public by nature (it appears in OAuth URLs) and safe to commit to source.
- `native-callback.html` does not store or transmit tokens — it only reads from the URL hash and immediately redirects to the deeplink.