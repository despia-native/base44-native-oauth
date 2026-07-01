# Native Google OAuth for Base44 Apps in Despia

A complete, production-tested guide for setting up native Google Sign-In in a [Base44](https://base44.com) web app wrapped with [Despia](https://despia.com).

---

## The Problem

When you wrap a web app in a native WebView (Despia), standard browser OAuth redirects break — the redirect from Google sends the user to an **external browser**, and the token never comes back to your app. This guide solves that using Despia's `oauth://` bridge and a static callback page.

---

## How It Works

```
User taps "Sign in with Google"
        │
        ▼ isDespia = true (Despia sets a custom User-Agent)
[Login.jsx]
Calls Base44 backend function → googleAuthUrl
(builds Google OAuth URL using GOOGLE_CLIENT_ID secret)
        │
        ▼
despia('oauth://?url=<google-oauth-url>')
Despia opens SECURE IN-APP BROWSER → Google Sign-In UI
        │
        ▼
User signs in with Google
Google redirects to:
  https://your-app.base44.app/native-callback.html
  #access_token=ya29...&state=myapp&token_type=Bearer
        │
        ▼
[native-callback.html] reads token + scheme from URL hash,
fires deeplink: myapp://oauth/auth?access_token=ya29...
        │
        ▼
Despia intercepts deeplink → navigates WebView to:
/auth?access_token=ya29...
        │
        ▼
[Auth.jsx] calls base44.auth.loginWithGoogle(googleToken)
(exchanges Google token for a real Base44 session token)
        │
        ▼
✅ User is authenticated, redirected to /
```

> **Key insight:** The Google implicit flow returns a **Google** access token. You can't call `base44.auth.setToken()` with it directly — that only accepts Base44-issued tokens. You must call `base44.auth.loginWithGoogle(googleToken)` to exchange it.

---

## Critical: Redirect URI Must Be Clean (No Query Params)

Google requires the redirect URI in your OAuth request to **exactly match** what's registered in Google Cloud Console — including any query parameters.

**✅ Correct approach:** Register `https://your-app.base44.app/native-callback.html` (no query string), and pass the deeplink scheme via the OAuth `state` parameter instead. Google returns `state` in the hash fragment, so `native-callback.html` can read it alongside the token.

**❌ Wrong approach:** `https://your-app.base44.app/native-callback.html?deeplink_scheme=myapp` — this forces you to register that exact query string in Google Console, which is fragile and breaks if the scheme changes.

---

## File Overview

| File | Role |
|---|---|
| `src/pages/Login.jsx` | Detects Despia env, calls backend, triggers `oauth://` |
| `src/pages/Auth.jsx` | Receives Google token, exchanges for Base44 session |
| `public/native-callback.html` | Static HTML bridge: reads token + state, fires deeplink |
| `base44/functions/googleAuthUrl/entry.ts` | Backend: builds Google OAuth URL, keeps Client ID off frontend |

---

## Setup Checklist

### Step 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID** → Type: **Web application**
3. Under **Authorized redirect URIs**, add **exactly** (no trailing slash, no query string):
   ```
   https://YOUR-APP.base44.app/native-callback.html
   ```
4. Copy your **Client ID** and **Client Secret**

### Step 2 — Base44 Secrets

Dashboard → **Settings** → **Environment Variables**, add:

| Secret Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` |

### Step 3 — Update Your Deeplink Scheme

In `src/pages/Login.jsx`, replace `myapp` with your actual Despia scheme:
```js
deeplink_scheme: 'myapp'  // ✏️ change this
```

### Step 4 — Register Deeplink in Despia

In your Despia project settings:
- **Scheme:** `myapp` (or your scheme)
- **Allowed path:** `oauth/auth`

---

## Complete File Contents

---

### `public/native-callback.html`

Static file served at `/native-callback.html`. Must be in `public/` — outside React Router.  
Google redirects here after sign-in. Reads token from URL hash, fires the Despia deeplink.

**Key:** The deeplink scheme travels via the OAuth `state` param (not as a query param on the redirect URI), so Google returns it in the hash alongside the token.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Completing sign in...</title>
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #fff;
      color: #888;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <p>Completing sign in...</p>
  <script>
    (function () {
      var params      = new URLSearchParams(window.location.search)
      var hash        = new URLSearchParams(window.location.hash.substring(1))

      // deeplink_scheme is passed via OAuth `state` param — Google returns it in the hash
      var scheme      = hash.get('state') || params.get('state') || params.get('deeplink_scheme')
      if (!scheme) { document.body.innerText = 'Error: missing deeplink scheme'; return }

      // Google puts the access_token in the URL hash (implicit flow)
      var accessToken = hash.get('access_token')
      var error       = hash.get('error') || params.get('error')

      if (!accessToken) {
        window.location.href = scheme + '://oauth/auth?error=' + encodeURIComponent(error || 'no_access_token')
        return
      }

      // Fire the deeplink — Despia intercepts and routes to /auth?access_token=...
      window.location.href =
        scheme + '://oauth/auth' +
        '?access_token=' + encodeURIComponent(accessToken)
    })()
  </script>
</body>
</html>
```

---

### `base44/functions/googleAuthUrl/entry.ts`

Base44 backend function (Deno). Builds the Google OAuth URL server-side.  
The `deeplink_scheme` is passed via the OAuth `state` param — keeping the redirect URI clean.

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, content-type'
        }
      });
    }

    const { deeplink_scheme } = await req.json();

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    if (!clientId) {
      return Response.json({ error: 'GOOGLE_CLIENT_ID secret not set' }, { status: 500 });
    }

    // ✏️ Replace with your Base44 app's public URL if it changes
    const APP_BASE_URL = 'https://YOUR-APP.base44.app';

    // redirectUri must EXACTLY match what's registered in Google Cloud Console — no query params
    const redirectUri = `${APP_BASE_URL}/native-callback.html`;

    // deeplink_scheme travels via `state` so the redirect URI stays clean
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'token',              // implicit flow — token returned in URL hash
      scope:         'openid email profile',
      state:         deeplink_scheme,      // passed back to native-callback.html via hash
    });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

### `src/pages/Login.jsx`

Detects Despia environment, switches between native and web OAuth flows.

```jsx
import despia from 'despia-native'   // npm install despia-native
import { base44 } from '@/api/base44Client'

const isDespia = navigator.userAgent.toLowerCase().includes('despia')

export default function Login() {
  const handleGoogleSignIn = async () => {
    if (isDespia) {
      // NATIVE: call backend for Google OAuth URL, then open via Despia bridge
      const res = await base44.functions.invoke('googleAuthUrl', {
        deeplink_scheme: 'myapp'  // ✏️ Replace with your Despia deeplink scheme
      })
      const { url } = res.data
      despia(`oauth://?url=${encodeURIComponent(url)}`)
    } else {
      // WEB: Base44's built-in Google OAuth
      base44.auth.loginWithProvider('google', window.location.origin + '/auth')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold font-heading text-foreground">Welcome</h1>
          <p className="text-sm text-muted-foreground text-center">Sign in to continue</p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 border border-border rounded-lg px-4 py-3 bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

---

### `src/pages/Auth.jsx`

OAuth callback page. Two flows:
- **Native (Despia deeplink):** Google token arrives as `?access_token=` query param → exchange via `loginWithGoogle()`
- **Web (Base44 loginWithProvider):** Base44 token arrives in `#hash` → set directly via `setToken()`

```jsx
import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const hash        = new URLSearchParams(window.location.hash.substring(1))
    const googleToken = searchParams.get('access_token') || hash.get('access_token')
    const base44Token = searchParams.get('token')        || hash.get('token')
    const error       = searchParams.get('error')        || hash.get('error')

    if (error) {
      console.error('Auth error:', error)
      navigate('/login')
      return
    }

    if (base44Token) {
      // Web flow: Base44 issues its own token directly via loginWithProvider
      base44.auth.setToken(base44Token)
      window.location.href = '/'
      return
    }

    if (googleToken) {
      // Native flow: exchange the Google access token for a Base44 session token
      // NOTE: setToken() only accepts Base44 tokens — loginWithGoogle() does the exchange
      base44.auth.loginWithGoogle(googleToken)
        .then(() => { window.location.href = '/' })
        .catch((err) => {
          console.error('Google token exchange failed:', err)
          navigate('/login')
        })
    }
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}
```

---

### `src/App.jsx` — Required Routes

```jsx
import Login from '@/pages/Login'
import Auth  from '@/pages/Auth'
import Home  from '@/pages/Home'

// Inside <Routes>:
<Route path="/login" element={<Login />} />
<Route path="/auth"  element={<Auth />} />
<Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
  <Route path="/" element={<Home />} />
</Route>
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` from Google | Redirect URI has query params or doesn't match exactly | Register exactly `https://YOUR-APP.base44.app/native-callback.html` — no query string, no trailing slash |
| Stuck on "Signing you in..." spinner | `setToken()` called with Google token instead of Base44 token | Use `base44.auth.loginWithGoogle(googleToken)` for the native flow — not `setToken()` |
| `native-callback.html` returns 404 | File not in `public/` folder | Must be `public/native-callback.html` — Vite serves `public/` as static assets |
| Deeplink not firing on device | Scheme not registered in Despia | Add scheme + `oauth/auth` path in Despia project settings |
| `GOOGLE_CLIENT_ID secret not set` | Secret missing | Add in Base44 dashboard → Settings → Environment Variables |
| Works on web, not in Despia | `isDespia` UA check failing | Log `navigator.userAgent` on device — confirm it contains "despia" |
| Token set but user appears logged out | Auth provider not reinitializing | `Auth.jsx` must use `window.location.href = '/'` not `navigate('/')` |

---

## Why `response_type=token` (Implicit Flow)

`native-callback.html` is a **fully static HTML file** — no server, no backend calls. Google must return the token directly in the URL hash (`#access_token=...`), which is what `response_type=token` does. The `state` param (your deeplink scheme) is also returned in the hash.

If you used `response_type=code`, Google returns a code in the query string. The static page can't exchange it for a token. **Do not change `response_type`.**

---

## What to Change Per Project (2 Things Only)

Search for `✏️`:

1. **`base44/functions/googleAuthUrl/entry.ts`** → Update `APP_BASE_URL` to your app's Base44 URL
2. **`src/pages/Login.jsx`** → Change `'myapp'` to your Despia deeplink scheme

---

## Resources

- **despia-native npm:** https://www.npmjs.com/package/despia-native
- **Despia setup docs:** https://setup.despia.com
- **Despia website:** https://despia.com
- **Despia MCP server** (AI agents / Cursor / Copilot): https://setup.despia.com/mcp
- **Despia llms.txt** (full docs for LLMs): https://setup.despia.com/llms.txt