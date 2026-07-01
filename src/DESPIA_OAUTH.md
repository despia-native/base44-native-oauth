# Native Google OAuth — Base44 + Despia

> **Production-tested template.** Search `✏️` for the only 2 things to change per project.

---

## ⚠️ What This Is

This guide is for developers using [Despia](https://despia.com) as a native app wrapper for their Base44 web app. It is **not** Base44's own mobile publishing feature.

Despia wraps your Base44 web app in a native iOS/Android WebView. Standard OAuth redirects don't work in WebViews (the user gets sent to an external browser and never comes back). This template solves that using Despia's `oauth://` bridge.

---

## How It Works

```
User taps "Sign in with Google"
        │
        ▼  isDespia = true (Despia sets a custom User-Agent)
[Login.jsx]
→ calls Base44 backend function: googleAuthUrl({ deeplink_scheme })
→ scheme travels via OAuth `state` param (keeps redirect URI clean)
        │
        ▼
despia('oauth://?url=<google-auth-url>')
→ Despia opens SECURE IN-APP BROWSER → Google Sign-In
        │
        ▼
Google redirects to:
  https://YOUR-APP.base44.app/native-callback.html
  #access_token=ya29...&state=myapp&token_type=Bearer
        │
        ▼
[native-callback.html]
→ reads access_token + state (deeplink scheme) from URL hash
→ fires: myapp://oauth/auth?access_token=ya29...
        │
        ▼
Despia intercepts deeplink → routes WebView to /auth?access_token=ya29...
        │
        ▼
[Auth.jsx]
→ calls base44.auth.loginWithGoogle(googleToken)
→ Base44 exchanges Google token for a real Base44 session token
→ window.location.href = '/'
        │
        ▼
✅ User authenticated. App loads.
```

### ⚠️ Critical: Two Token Types

The Google implicit flow returns a **Google** access token. You **cannot** call `base44.auth.setToken()` with it — that only accepts Base44-issued tokens.  
You must call `base44.auth.loginWithGoogle(googleToken)` which exchanges it with Base44's backend.

### ⚠️ Critical: Redirect URI Must Have No Query Params

Register `https://YOUR-APP.base44.app/native-callback.html` in Google Cloud Console — **no query string**. Pass the deeplink scheme via OAuth `state` param instead. Google returns `state` in the hash, so `native-callback.html` can read it.

---

## Required: Install Despia npm Package

```bash
npm install despia-native
```

- **npm:** https://www.npmjs.com/package/despia-native
- **Despia setup docs:** https://setup.despia.com
- **Despia MCP server** (AI / Cursor / Copilot): https://setup.despia.com/mcp
- **Despia llms.txt** (LLM docs index): https://setup.despia.com/llms.txt

`despia-native` is a **no-op in regular browsers** — safe to import unconditionally.

---

## Files to Create / Replace

| File | Action | Purpose |
|---|---|---|
| `public/native-callback.html` | **CREATE** | Static OAuth bridge — reads Google token + state, fires deeplink |
| `base44/functions/googleAuthUrl/entry.ts` | **CREATE** | Backend — builds Google OAuth URL, keeps Client ID off frontend |
| `src/pages/Login.jsx` | **CREATE/REPLACE** | Login page — native and web flows |
| `src/pages/Auth.jsx` | **CREATE/REPLACE** | OAuth callback — exchanges Google token for Base44 session |
| `src/pages/Home.jsx` | **CREATE/REPLACE** | Example authenticated home page |
| `src/App.jsx` | **REPLACE** | Router with public + protected routes |
| `src/api/base44Client.js` | **CREATE** | Pre-initialized Base44 SDK client |
| `src/lib/app-params.js` | **CREATE** | Reads runtime config from URL params / env vars |
| `src/lib/query-client.js` | **CREATE** | TanStack Query client singleton |
| `src/lib/AuthContext.jsx` | **CREATE** | Global auth state provider |
| `src/components/ProtectedRoute.jsx` | **CREATE** | Route guard — redirects to /login if not authenticated |
| `src/components/UserNotRegisteredError.jsx` | **CREATE** | Shown for unregistered users |
| `src/components/ScrollToTop.jsx` | **CREATE** | Resets scroll on route change |

---

## Setup Checklist

### Step 1 — Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID** → Type: **Web application**
3. **Authorized redirect URIs** — add **exactly** (no query string, no trailing slash):
   ```
   https://YOUR-APP.base44.app/native-callback.html
   ```
4. Save → copy **Client ID** and **Client Secret**

### Step 2 — Base44 Secrets

Dashboard → **Settings** → **Environment Variables**:

| Secret | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` |

### Step 3 — Update Deeplink Scheme

In `src/pages/Login.jsx`:
```js
deeplink_scheme: 'myapp'  // ✏️ change to your Despia scheme
```

### Step 4 — Update App Base URL

In `base44/functions/googleAuthUrl/entry.ts`:
```ts
const APP_BASE_URL = 'https://YOUR-APP.base44.app'  // ✏️ change this
```

### Step 5 — Register Deeplink in Despia

- **Scheme:** your scheme (e.g. `myapp`)
- **Allowed path:** `oauth/auth`

---

## Complete File Contents

---

### `public/native-callback.html`

> Must be in `public/` — served as a static asset, completely outside React Router.

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
      background: #ffffff;
      color: #888888;
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

      // Google returns access_token in the URL hash (implicit flow)
      var accessToken = hash.get('access_token')
      var error       = hash.get('error') || params.get('error')

      if (!accessToken) {
        window.location.href = scheme + '://oauth/auth?error=' + encodeURIComponent(error || 'no_access_token')
        return
      }

      // Fire the deeplink — Despia intercepts and routes WebView to /auth?access_token=...
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

> Called by Login.jsx via `base44.functions.invoke('googleAuthUrl', { deeplink_scheme })`.  
> Auto-deploys when saved. Test: Base44 dashboard → Code → Functions → googleAuthUrl.

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

    // ✏️ Replace with your Base44 app's public URL
    const APP_BASE_URL = 'https://YOUR-APP.base44.app';

    // Redirect URI must EXACTLY match Google Cloud Console — no query params
    const redirectUri = `${APP_BASE_URL}/native-callback.html`;

    // deeplink_scheme travels via `state` — Google returns it in the hash
    // so native-callback.html can read it without polluting the redirect URI
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'token',               // implicit flow — token in URL hash
      scope:         'openid email profile',
      state:         deeplink_scheme,       // returned in hash by Google
    });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

### `src/pages/Login.jsx`

```jsx
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'

const isDespia = navigator.userAgent.toLowerCase().includes('despia')

export default function Login() {
  const handleGoogleSignIn = async () => {
    if (isDespia) {
      const res = await base44.functions.invoke('googleAuthUrl', {
        deeplink_scheme: 'myapp'  // ✏️ Replace with your Despia deeplink scheme
      })
      const { url } = res.data
      despia(`oauth://?url=${encodeURIComponent(url)}`)
    } else {
      base44.auth.loginWithProvider('google', window.location.origin + '/auth')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
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

        <p className="text-xs text-muted-foreground text-center">
          By signing in, you agree to our terms of service
        </p>
      </div>
    </div>
  )
}
```

---

### `src/pages/Auth.jsx`

> **Key:** Native flow receives a Google token → must use `loginWithGoogle()` to exchange for Base44 session.  
> Web flow receives a Base44 token in the hash → use `setToken()` directly.

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
      // Web flow: Base44 issued this token via loginWithProvider
      base44.auth.setToken(base44Token)
      window.location.href = '/'
      return
    }

    if (googleToken) {
      // Native flow: exchange the Google token for a Base44 session
      // setToken() only accepts Base44 tokens — loginWithGoogle() does the exchange
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

### `src/pages/Home.jsx`

> Example authenticated page — replace with your app's content.

```jsx
import { useEffect, useState } from 'react'
import { base44 } from '@/api/base44Client'

export default function Home() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {})
  }, [])

  const handleLogout = () => {
    base44.auth.logout('/login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
          {user?.full_name?.[0] || user?.email?.[0] || '?'}
        </div>
        <h1 className="text-xl font-bold font-heading text-foreground">
          {user?.full_name || 'Welcome!'}
        </h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>
      <button
        onClick={handleLogout}
        className="px-6 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
```

---

### `src/App.jsx`

```jsx
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from '@/components/ScrollToTop';
import Login from '@/pages/Login';
import Auth from '@/pages/Auth';
import Home from '@/pages/Home';

// ✏️ Import your own pages here

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth"  element={<Auth />} />
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/" element={<Home />} />
              {/* ✏️ Add protected pages here */}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | Redirect URI in Google Console has query params or doesn't match | Register exactly `https://YOUR-APP.base44.app/native-callback.html` — no query string |
| Stuck on "Signing you in..." | `setToken()` called with a Google token | Use `base44.auth.loginWithGoogle(googleToken)` for native flow |
| `native-callback.html` returns 404 | File not in `public/` folder | Must be `public/native-callback.html` |
| Deeplink not intercepted | Scheme not registered in Despia | Add scheme + `oauth/auth` path in Despia project settings |
| `GOOGLE_CLIENT_ID secret not set` | Secret missing | Add in Base44 dashboard → Settings → Environment Variables |
| Works on web, not in Despia | `isDespia` UA check failing | Log `navigator.userAgent` on device — confirm it contains "despia" |
| User appears logged out after redirect | Auth not reinitializing | `Auth.jsx` must use `window.location.href = '/'` not `navigate('/')` |

---

## Why `response_type=token` (Implicit Flow) Is Required

`native-callback.html` is a fully static HTML file — no server, no API calls. Google must return the token directly in the URL hash. That's what `response_type=token` (implicit flow) does. `state` is also returned in the hash, so the page can read both the token and the deeplink scheme in one shot. **Do not change `response_type` to `code`.**

---

## What to Change Per Project (2 Things)

Search `✏️`:
1. **`base44/functions/googleAuthUrl/entry.ts`** → `APP_BASE_URL` = your app's Base44 URL
2. **`src/pages/Login.jsx`** → `deeplink_scheme` = your Despia app scheme