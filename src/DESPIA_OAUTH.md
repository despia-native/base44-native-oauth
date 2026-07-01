# Native Google OAuth — Base44 + Despia

> **Production-tested template.** Search `✏️` for the only 2 things to change per project.

---

## ⚠️ What This Is

This guide is for developers using [Despia](https://despia.com) as a native app wrapper for their Base44 web app. It is **not** Base44's own mobile publishing feature.

Despia wraps your Base44 web app in a native iOS/Android WebView. Standard OAuth redirects don't work in WebViews (the user gets sent to an external browser and never comes back). This template solves that cleanly.

---

## The Full Mental Model

Standard OAuth is a redirect dance — the browser leaves your app, goes to Google, comes back with a token. That breaks in native WebViews.

The native approach is different. Instead of a redirect dance, you:

1. **Get a Google token via in-app browser** (Despia's `oauth://` bridge handles this seamlessly)
2. **Send that token to your own backend** (a Base44 function)
3. **Backend verifies it with Google** — Google confirms it's real and returns the user's email
4. **Backend finds or creates the Base44 user** by that email
5. **Backend issues a real Base44 JWT** for that user (`sso.getAccessToken`)
6. **Frontend sets that token** — fully authenticated, same as any normal login

You're not bypassing security — you're shifting where the verification happens (from client redirect to server API call). The result is more secure because nothing happens client-side without server confirmation.

```
User taps "Sign in with Google"
        │
        ▼  isDespia = true
[Login.jsx]
→ calls backend: googleAuthUrl({ deeplink_scheme })
→ backend builds Google OAuth URL (GOOGLE_CLIENT_ID stays server-side)
        │
        ▼
despia('oauth://?url=<google-auth-url>')
→ Despia opens SECURE IN-APP BROWSER → Google Sign-In
        │
        ▼
Google redirects to native-callback.html
#access_token=ya29...&state=myapp
        │
        ▼
[native-callback.html] reads token + scheme from hash
→ fires: myapp://oauth/auth?access_token=ya29...
        │
        ▼
Despia intercepts deeplink → routes WebView to /auth?access_token=ya29...
        │
        ▼
[Auth.jsx] sends Google token to backend: googleSignIn({ google_token })
        │
        ▼
[googleSignIn backend function]
  1. Verifies token with Google tokeninfo API
     → Google confirms: valid token, user email = user@gmail.com
  2. Looks up user by email in Base44 (asServiceRole)
  3. If not found → creates user via inviteUser, re-fetches
  4. Issues Base44 JWT: asServiceRole.sso.getAccessToken(user.id)
  5. Returns { access_token: "<base44-jwt>" }
        │
        ▼
[Auth.jsx]
→ base44.auth.setToken(access_token)   ← real Base44 token, not Google token
→ window.location.href = '/'
        │
        ▼
✅ User authenticated. App loads.
```

### Why Two Backend Functions?

| Function | Role |
|---|---|
| `googleAuthUrl` | Builds the Google OAuth URL (keeps GOOGLE_CLIENT_ID server-side) |
| `googleSignIn` | Verifies Google token + issues Base44 JWT (the auth brain) |

`googleAuthUrl` is optional if you put the Client ID in the frontend — but keeping it server-side is cleaner. `googleSignIn` is the critical one that makes native auth work.

### Key Insight: Two Different Tokens

| Token | What it is | What you do with it |
|---|---|---|
| Google access token (`ya29...`) | Proves the user authenticated with Google | Send to `googleSignIn` backend — never use directly in Base44 |
| Base44 JWT | Proves the user is authenticated in **your app** | `base44.auth.setToken(token)` — this is the real session |

`base44.auth.setToken()` only accepts Base44 JWTs. If you pass a Google token to it, the session appears to set but every subsequent API call fails — you get stuck on the spinner. Always exchange first via the backend.

---

## Critical: Redirect URI Must Be Clean

Register `https://YOUR-APP.base44.app/native-callback.html` in Google Cloud Console — **no query string**. Pass the deeplink scheme via the OAuth `state` param. Google returns `state` in the hash alongside the token.

---

## Setup Checklist

### Step 1 — Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID** → Type: **Web application**
3. **Authorized redirect URIs** — add exactly (no query string, no trailing slash):
   ```
   https://YOUR-APP.base44.app/native-callback.html
   ```
4. Copy **Client ID** and **Client Secret**

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

> Must be in `public/` — static asset, outside React Router. Google redirects here after sign-in.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Completing sign in...</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center;
      min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #fff; color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <p>Completing sign in...</p>
  <script>
    (function () {
      var params      = new URLSearchParams(window.location.search)
      var hash        = new URLSearchParams(window.location.hash.substring(1))
      // deeplink_scheme travels via OAuth `state` — Google returns it in the hash
      var scheme      = hash.get('state') || params.get('state') || params.get('deeplink_scheme')
      if (!scheme) { document.body.innerText = 'Error: missing deeplink scheme'; return }

      var accessToken = hash.get('access_token')
      var error       = hash.get('error') || params.get('error')

      if (!accessToken) {
        window.location.href = scheme + '://oauth/auth?error=' + encodeURIComponent(error || 'no_access_token')
        return
      }
      // Fire deeplink — Despia intercepts and routes WebView to /auth?access_token=...
      window.location.href = scheme + '://oauth/auth?access_token=' + encodeURIComponent(accessToken)
    })()
  </script>
</body>
</html>
```

---

### `base44/functions/googleAuthUrl/entry.ts`

> Builds the Google OAuth URL. Keeps GOOGLE_CLIENT_ID server-side.

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { deeplink_scheme } = await req.json();
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    if (!clientId) return Response.json({ error: 'GOOGLE_CLIENT_ID secret not set' }, { status: 500 });

    // ✏️ Replace with your Base44 app's public URL
    const APP_BASE_URL = 'https://YOUR-APP.base44.app';

    // Redirect URI must EXACTLY match Google Cloud Console — no query params
    const redirectUri = `${APP_BASE_URL}/native-callback.html`;

    // deeplink_scheme travels via `state` — Google returns it in the hash
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'token',
      scope:         'openid email profile',
      state:         deeplink_scheme,
    });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

### `base44/functions/googleSignIn/entry.ts`

> The auth brain. Verifies Google token → finds/creates user → issues Base44 JWT.

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }

    const { google_token } = await req.json();
    if (!google_token) return Response.json({ error: 'google_token is required' }, { status: 400 });

    // ── 1. Verify with Google ─────────────────────────────────────────────────
    // Ask Google: "is this token valid?" — returns email, sub, expiry or error.
    // This is the security gate. Fake/expired tokens are rejected here.
    const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${google_token}`);
    if (!tokenInfoRes.ok) return Response.json({ error: 'Invalid Google token' }, { status: 401 });

    const tokenInfo = await tokenInfoRes.json();
    if (!tokenInfo.email || tokenInfo.error_description) {
      return Response.json({ error: tokenInfo.error_description || 'Token missing email scope' }, { status: 401 });
    }

    const googleEmail = tokenInfo.email.toLowerCase().trim();

    // ── 2. Find or create user in Base44 ──────────────────────────────────────
    const base44 = createClientFromRequest(req);
    let users = await base44.asServiceRole.entities.User.filter({ email: googleEmail });
    let user = users?.[0];

    if (!user) {
      // User doesn't exist yet — create them. inviteUser registers the email
      // without requiring any client-side interaction.
      await base44.users.inviteUser(googleEmail, 'user');
      const newUsers = await base44.asServiceRole.entities.User.filter({ email: googleEmail });
      user = newUsers?.[0];
    }

    if (!user) return Response.json({ error: 'Failed to find or create user' }, { status: 500 });

    // ── 3. Issue a real Base44 JWT for this user ──────────────────────────────
    // sso.getAccessToken returns the same kind of token that loginWithProvider gives.
    // The frontend sets this with base44.auth.setToken() — fully authenticated.
    const { access_token } = await base44.asServiceRole.sso.getAccessToken(user.id);

    return Response.json({ access_token, user: { id: user.id, email: user.email, full_name: user.full_name } });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

### `src/pages/Login.jsx`

```jsx
import despia from 'despia-native'   // npm install despia-native
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
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Welcome</h1>
          <p className="text-sm text-muted-foreground text-center">Sign in to continue</p>
        </div>
        <button onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 border border-border rounded-lg px-4 py-3 bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground shadow-sm">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
        <p className="text-xs text-muted-foreground text-center">By signing in, you agree to our terms of service</p>
      </div>
    </div>
  )
}
```

---

### `src/pages/Auth.jsx`

> Two flows. Native: Google token → `googleSignIn` backend → Base44 JWT → `setToken`.  
> Web: Base44 issues its own token via redirect → arrives in hash → `setToken`.

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

    if (error) { console.error('Auth error:', error); navigate('/login'); return }

    if (base44Token) {
      // Web flow: Base44 issued this token directly via loginWithProvider
      base44.auth.setToken(base44Token)
      window.location.href = '/'
      return
    }

    if (googleToken) {
      // Native flow:
      //   1. Send Google token to backend
      //   2. Backend verifies with Google API
      //   3. Backend finds/creates user by email
      //   4. Backend issues real Base44 JWT via sso.getAccessToken
      //   5. We setToken with the Base44 JWT — done
      base44.functions.invoke('googleSignIn', { google_token: googleToken })
        .then((res) => {
          const { access_token } = res.data
          base44.auth.setToken(access_token)
          window.location.href = '/'
        })
        .catch((err) => {
          console.error('Google sign-in failed:', err)
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
| `redirect_uri_mismatch` | Google Console URI has query params | Register exactly `https://YOUR-APP.base44.app/native-callback.html` |
| Stuck on "Signing you in..." | `setToken()` called with Google token | Never pass Google token to `setToken()` — always go through `googleSignIn` backend first |
| `googleSignIn` returns 401 | Google token invalid/expired | Token expired in transit — try again; check clock skew |
| `native-callback.html` 404 | Wrong folder | Must be `public/native-callback.html` |
| Deeplink not intercepted | Scheme not registered | Add scheme + `oauth/auth` in Despia project settings |
| `GOOGLE_CLIENT_ID secret not set` | Missing secret | Add in Base44 → Settings → Environment Variables |
| Works on web, not Despia | UA check failing | Log `navigator.userAgent` on device — must contain "despia" |
| User appears logged out after redirect | Using `navigate()` instead of `window.location.href` | Must use hard redirect to force auth re-init |

---

## Why `response_type=token` (Implicit Flow)

`native-callback.html` is fully static — no server, no API calls. Google must return the token in the URL hash. `state` (the deeplink scheme) is also returned in the hash. **Do not change `response_type` to `code`.**

---

## What to Change Per Project (2 Things)

Search `✏️`:
1. **`base44/functions/googleAuthUrl/entry.ts`** → `APP_BASE_URL` = your app's URL
2. **`src/pages/Login.jsx`** → `deeplink_scheme` = your Despia scheme

---

## Resources

- **despia-native npm:** https://www.npmjs.com/package/despia-native
- **Despia setup docs:** https://setup.despia.com
- **Despia MCP server** (AI / Cursor / Copilot): https://setup.despia.com/mcp
- **Despia llms.txt** (LLM docs): https://setup.despia.com/llms.txt