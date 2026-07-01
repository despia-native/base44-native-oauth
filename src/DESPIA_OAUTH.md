# Native Google OAuth — Base44 + Despia

> **Copy-paste complete template.** Every file is production-ready. Search `✏️` for the only 2 things you need to change per project.

---

## ⚠️ Important: This Is NOT Base44's Own Mobile Solution

**Base44 has its own native mobile publishing/deployment flow** — if you want to publish your Base44 app to the App Store or Google Play through Base44's platform, use that instead. This guide is not for that.

**This guide is for developers who have chosen [Despia](https://despia.com) as their native app runtime.** Despia is a third-party hybrid app wrapper service — one of the oldest and most established in the market, having built WebView-based native apps since 2011. It wraps any web app into a fully native iOS/Android app with access to native device APIs, deep links, push notifications, and more.

**Despia works seamlessly with Base44 apps** — your Base44 web app runs inside Despia's WebView as if it's a native app. But because Despia and Base44 are separate products, certain native flows (like OAuth) need a small bridge. That's what this template provides.

---

## What Problem This Solves

Standard Google OAuth does a browser redirect. In a native WebView (Despia), that redirect opens the system browser — and the token never comes back to your app.

This template bridges that gap using:
- **Despia's `oauth://` bridge** — opens Google Sign-In in a secure in-app browser session
- **A static callback page** (`native-callback.html`) — reads the token and fires a deeplink back into the WebView
- **A Base44 backend function** — builds the OAuth URL server-side so credentials stay off the client

On **web** (non-Despia), the exact same codebase uses Base44's built-in `loginWithProvider('google')` — no extra config needed.

---

## How It Works

```
User taps "Sign in with Google"
        │
        ▼  isDespia = true (Despia sets a custom User-Agent)
[Login.jsx]
Calls Base44 backend function → googleAuthUrl
(builds Google OAuth URL server-side using GOOGLE_CLIENT_ID secret)
        │
        ▼
despia('oauth://?url=<encoded-google-auth-url>')
Despia opens SECURE IN-APP BROWSER → Google Sign-In UI
        │
        ▼
User completes Google Sign-In
Google redirects to:
  https://YOUR-APP.base44.app/native-callback.html
  ?deeplink_scheme=myapp
  #access_token=ya29.a0...&token_type=Bearer
        │
        ▼
[native-callback.html] — static file, no React, no server
Reads access_token from URL hash (#)
Fires deeplink: myapp://oauth/auth?access_token=ya29.a0...
        │
        ▼
Despia intercepts the deeplink
Routes the WebView to: /auth?access_token=ya29.a0...
        │
        ▼
[Auth.jsx]
Reads access_token from URL query params
Calls base44.auth.setToken(accessToken)
Hard redirect → window.location.href = '/'
        │
        ▼
✅ User is authenticated. App loads.
```

---

## Required: Install Despia npm Package

```bash
npm install despia-native
```

**npm:** https://www.npmjs.com/package/despia-native  
**Despia docs:** https://docs.despia.com  
**Despia website:** https://despia.com

The `despia-native` package exposes the `despia()` bridge function that communicates with the native Despia wrapper. It is a **no-op when running in a regular browser** — completely safe to import unconditionally in your code without breaking web builds.

```js
// Safe to use anywhere — does nothing outside Despia
import despia from 'despia-native'

// Open a URL in Despia's secure in-app browser
despia('oauth://?url=' + encodeURIComponent(oauthUrl))
```

---

## Files to Create / Replace

| File | Action | Purpose |
|---|---|---|
| `public/native-callback.html` | **CREATE** | Static OAuth bridge page — reads Google token, fires deeplink |
| `base44/functions/googleAuthUrl/entry.ts` | **CREATE** | Base44 backend function — builds Google OAuth URL securely |
| `src/api/base44Client.js` | **CREATE** | Base44 SDK client instance |
| `src/lib/app-params.js` | **CREATE** | Reads app config from URL params / env vars |
| `src/lib/query-client.js` | **CREATE** | TanStack Query client config |
| `src/lib/AuthContext.jsx` | **CREATE** | Auth state provider (wraps entire app) |
| `src/components/ProtectedRoute.jsx` | **CREATE** | Route guard — redirects to /login if not authenticated |
| `src/components/UserNotRegisteredError.jsx` | **CREATE** | Shown when user's account isn't registered for the app |
| `src/components/ScrollToTop.jsx` | **CREATE** | Resets scroll position on route change |
| `src/pages/Login.jsx` | **CREATE/REPLACE** | Login page — handles both Despia native and web flows |
| `src/pages/Auth.jsx` | **CREATE/REPLACE** | OAuth callback — receives token, establishes session |
| `src/pages/Home.jsx` | **CREATE/REPLACE** | Example authenticated home page |
| `src/App.jsx` | **REPLACE** | Router with protected route setup |

---

## Setup Checklist

### Step 1 — Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID** → Type: **Web application**
3. Under **Authorized redirect URIs**, add **exactly**:
   ```
   https://YOUR-APP.base44.app/native-callback.html
   ```
   > Replace `YOUR-APP` with your Base44 subdomain (e.g. `myapp-abc123.base44.app`). No trailing slash. Must be `https`.
4. Save. Copy the **Client ID** and **Client Secret**.

### Step 2 — Base44 Secrets

Dashboard → **Settings** → **Environment Variables**, add both:

| Secret Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | `754083834914-xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` |

These are read by the backend function — never exposed to the frontend.

### Step 3 — Replace Your Deeplink Scheme

In `src/pages/Login.jsx`, replace `myapp` with your actual Despia deeplink scheme:
```js
deeplink_scheme: 'myapp'  // ✏️ change this
```

### Step 4 — Register Deeplink in Despia

In your Despia project settings:
- **Scheme:** `myapp` (or your scheme)
- **Allowed path:** `oauth/auth`

This tells Despia to intercept `myapp://oauth/auth` links and route them into the WebView.

---

## Why `response_type=token` (Implicit Flow) Is Required Here

This setup **must** use the OAuth implicit flow. Do not change it.

`native-callback.html` is a **fully static HTML file** with no server, no backend, and no ability to make API calls. The only way it can read the token and fire the Despia deeplink is if Google returns the token directly in the **URL hash** (`#access_token=...`).

That's exactly what `response_type=token` does — Google puts the token in the hash fragment after the redirect, which JavaScript can read with `window.location.hash`.

If you used `response_type=code`, Google returns a short-lived authorization code in the query string instead. `native-callback.html` would have no way to exchange it for a token (that exchange requires a server-side POST with your Client Secret). The deeplink would fire with a useless code, and Auth.jsx would break.

**Rule: `response_type=token` is intentional and required for this architecture. Do not change it.**

---

## Complete File Contents

---

### `public/native-callback.html`

> **Must be in `public/`** — served as a raw static file, completely outside React Router.  
> Google redirects here after sign-in. This page reads the token from the URL hash and immediately fires the Despia deeplink. The user sees it for less than a second.

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
      // The deeplink scheme was passed as a query param when the backend built the OAuth URL
      // e.g. ?deeplink_scheme=myapp
      var params = new URLSearchParams(window.location.search)
      var scheme = params.get('deeplink_scheme')

      if (!scheme) {
        document.body.innerText = 'Error: missing deeplink_scheme in redirect URI'
        return
      }

      // Google implicit flow returns the access_token in the URL hash fragment
      // e.g. #access_token=ya29.a0...&token_type=Bearer&expires_in=3599
      var hash        = new URLSearchParams(window.location.hash.substring(1))
      var accessToken = hash.get('access_token')
      var error       = hash.get('error') || params.get('error')

      if (!accessToken) {
        // Fire error deeplink so Auth.jsx can redirect back to login
        window.location.href = scheme + '://oauth/auth?error=' + encodeURIComponent(error || 'no_access_token')
        return
      }

      // Fire the success deeplink.
      // Despia intercepts this URL scheme and navigates the WebView to /auth?access_token=...
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

> Base44 backend function (Deno runtime). Reads `GOOGLE_CLIENT_ID` from secrets — it never touches the frontend.  
> Called by Login.jsx via `base44.functions.invoke('googleAuthUrl', { deeplink_scheme })`.  
> Deploy: Base44 auto-deploys on save. Test via dashboard → Code → Functions → googleAuthUrl.

```typescript
// base44/functions/googleAuthUrl/entry.ts
// Base44 backend function — builds the Google OAuth URL server-side.
// GOOGLE_CLIENT_ID is read from Base44 secrets (never sent to the browser).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight (required for browser-invoked functions)
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, content-type'
        }
      });
    }

    // Read the deeplink scheme sent by Login.jsx (e.g. "myapp")
    const { deeplink_scheme } = await req.json();

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    if (!clientId) {
      return Response.json({ error: 'GOOGLE_CLIENT_ID secret is not set in Base44 environment variables' }, { status: 500 });
    }

    // Build the redirect URI — must EXACTLY match what's registered in Google Cloud Console.
    // The deeplink_scheme is passed as a query param so native-callback.html knows which
    // app deeplink to fire after receiving the token.
    const redirectUri =
      `https://${req.headers.get('host')}/native-callback.html` +
      `?deeplink_scheme=${encodeURIComponent(deeplink_scheme)}`;

    // response_type=token → implicit flow.
    // REQUIRED: native-callback.html is a static page with no backend.
    // It can only read a token that's already in the URL hash — which is what implicit flow provides.
    // DO NOT change response_type to 'code' — that would break the deeplink bridge.
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'token',                    // implicit flow — required, see note above
      scope:         'openid email profile',     // adjust scopes if your app needs more
    });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

### `src/api/base44Client.js`

> The pre-initialized Base44 SDK client. Import `base44` from here everywhere in the app.

```js
// src/api/base44Client.js
// Pre-initialized Base44 SDK client.
// Import { base44 } from '@/api/base44Client' in every page/component that needs auth or data.

import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',       // empty = use hosted Base44 backend
  requiresAuth: false, // allow unauthenticated pages (auth is enforced per-route via ProtectedRoute)
  appBaseUrl
});
```

---

### `src/lib/app-params.js`

> Reads app config from URL query params (injected by Base44 runtime) and falls back to env vars for local dev.  
> Values are persisted to localStorage so they survive page reloads.

```js
// src/lib/app-params.js
// Reads runtime configuration from URL params injected by the Base44 platform,
// with env var fallbacks for local development.

const isBrowser = typeof window !== 'undefined';

function toCamelCase(str) {
  return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function getParam(name, defaultValue = null) {
  if (!isBrowser) return defaultValue;

  const camelName = toCamelCase(name);
  const urlParams = new URLSearchParams(window.location.search);
  let value = urlParams.get(name) || urlParams.get(camelName);

  if (value) {
    // Persist to localStorage for subsequent page loads
    try { localStorage.setItem(name, value); } catch {}
    // Strip the param from the URL bar (cosmetic — avoids sharing tokens in URLs)
    urlParams.delete(name);
    urlParams.delete(camelName);
    const newUrl =
      window.location.pathname +
      (urlParams.toString() ? '?' + urlParams.toString() : '') +
      window.location.hash;
    window.history.replaceState({}, '', newUrl);
    return value;
  }

  try { value = localStorage.getItem(name); } catch {}
  return value || defaultValue;
}

export const appParams = {
  appId:            getParam('app_id',          import.meta.env.VITE_BASE44_APP_ID),
  token:            getParam('token'),
  functionsVersion: getParam('functions_version'),
  appBaseUrl:       getParam('app_base_url',    import.meta.env.VITE_BASE44_APP_BASE_URL),
};
```

---

### `src/lib/query-client.js`

> TanStack Query client singleton — shared across the app via `<QueryClientProvider>`.

```js
// src/lib/query-client.js
import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // don't re-fetch when user switches tabs
      retry: 1,                    // retry failed queries once before showing an error
    },
  },
});
```

---

### `src/lib/AuthContext.jsx`

> React context that manages auth state for the entire app.  
> Wrap your app root with `<AuthProvider>` (done in App.jsx below).  
> Consume with `useAuth()` in any component.

```jsx
// src/lib/AuthContext.jsx
// Global auth state. Checks Base44 app settings and user auth on startup.
// Exposes: user, isAuthenticated, isLoadingAuth, authError, logout, navigateToLogin

import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                               = useState(null);
  const [isAuthenticated, setIsAuthenticated]         = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]             = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError]                     = useState(null);
  const [authChecked, setAuthChecked]                 = useState(false);
  const [appPublicSettings, setAppPublicSettings]     = useState(null);

  useEffect(() => { checkAppState(); }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // Fetch app public settings (always available, even for unauthenticated users)
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true
      });

      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);

        // Only check user auth if we have a token
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          setAuthError({ type: appError.data.extra_data.reason, message: appError.message });
        } else {
          setAuthError({ type: 'unknown', message: appError.message || 'Failed to load app' });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error in checkAppState:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      if (error.status === 401 || error.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Usage: const { user, isAuthenticated, logout } = useAuth();
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
```

---

### `src/components/ProtectedRoute.jsx`

> Wraps protected routes in App.jsx. Shows a spinner while auth is loading, redirects to login if not authenticated.

```jsx
// src/components/ProtectedRoute.jsx
// Route guard — renders children if authenticated, otherwise renders unauthenticatedElement.
//
// Usage in App.jsx:
//   <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
//     <Route path="/" element={<Home />} />
//   </Route>

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Default loading spinner — override with the `fallback` prop if desired
const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) checkUserAuth();
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  // Still loading — show spinner
  if (isLoadingAuth || !authChecked) return fallback;

  // Auth error — show appropriate UI
  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    return unauthenticatedElement; // e.g. redirect to /login
  }

  // Not authenticated — render unauthenticatedElement (typically <Navigate to="/login" />)
  if (!isAuthenticated) return unauthenticatedElement;

  // Authenticated — render the child route
  return <Outlet />;
}
```

---

### `src/components/UserNotRegisteredError.jsx`

> Shown when a user is authenticated with Google but their account hasn't been registered for this specific app.

```jsx
// src/components/UserNotRegisteredError.jsx
// Displayed when authError.type === 'user_not_registered'.
// This happens when a valid token exists but the user isn't registered for this Base44 app.

export default function UserNotRegisteredError() {
  const handleBack = () => {
    // Clear all local state and return to login
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your account is not registered for this app. Please contact the app administrator.
        </p>
        <button
          onClick={handleBack}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
```

---

### `src/components/ScrollToTop.jsx`

> Resets scroll position to top on route change. Required for clean page transitions in a SPA.

```jsx
// src/components/ScrollToTop.jsx
// Scrolls to top on every route change (except browser back/forward navigation).
// Place inside <Router> in App.jsx.

import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return; // let browser handle back/forward scroll
    if (hash) {
      // Scroll to anchor link target
      const id = hash.slice(1);
      const timer = setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => clearTimeout(timer);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}
```

---

### `src/pages/Login.jsx`

> ✏️ **Change `myapp` to your Despia deeplink scheme** (line marked below).

```jsx
// src/pages/Login.jsx
// Handles both native (Despia) and web Google Sign-In.
//
// NATIVE FLOW (inside Despia):
//   1. Invokes Base44 backend to get Google OAuth URL
//   2. Passes URL to Despia's oauth:// bridge → opens in-app browser
//   3. After Google sign-in, Despia fires a deeplink → /auth?access_token=...
//
// WEB FLOW (regular browser):
//   Base44's built-in loginWithProvider handles everything automatically.
//
// The isDespia check uses User-Agent — Despia injects "Despia" into the UA string.

import despia from 'despia-native'    // npm: https://www.npmjs.com/package/despia-native
import { base44 } from '@/api/base44Client'

// True when running inside the Despia native wrapper
// Despia injects its name into the User-Agent string on both iOS and Android
const isDespia = navigator.userAgent.toLowerCase().includes('despia')

export default function Login() {
  const handleGoogleSignIn = async () => {
    if (isDespia) {
      // ── NATIVE PATH ──────────────────────────────────────────────
      // Call our Base44 backend function to build the Google OAuth URL.
      // The GOOGLE_CLIENT_ID lives in Base44 secrets — never in the browser.
      const res = await base44.functions.invoke('googleAuthUrl', {
        deeplink_scheme: 'myapp'  // ✏️ Replace with your Despia deeplink scheme
      })
      const { url } = res.data

      // Tell Despia to open this URL in its secure in-app browser (not the system browser).
      // After Google sign-in, Despia will intercept the deeplink and route back to /auth.
      despia(`oauth://?url=${encodeURIComponent(url)}`)
    } else {
      // ── WEB PATH ─────────────────────────────────────────────────
      // Use Base44's built-in Google OAuth — redirects to Google, then returns to /auth.
      base44.auth.loginWithProvider('google', window.location.origin + '/auth')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* App icon / branding — replace with your own */}
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

        {/* Google Sign-In button */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 border border-border rounded-lg px-4 py-3 bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground shadow-sm"
        >
          {/* Official Google logo colors — do not change per Google's branding guidelines */}
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

> OAuth callback page. Handles both the native deeplink (`?access_token=` query param) and the web OAuth redirect (token in URL `#hash`).

```jsx
// src/pages/Auth.jsx
// OAuth callback — receives the access token and establishes a Base44 session.
//
// Token arrives in two different ways depending on how sign-in was initiated:
//
//   NATIVE (Despia deeplink):
//     Despia intercepts myapp://oauth/auth?access_token=... and routes to:
//     /auth?access_token=ya29.a0...
//     → Token is in URL query params (searchParams)
//
//   WEB (Base44 loginWithProvider):
//     Base44's own OAuth flow redirects to:
//     /auth#access_token=ya29.a0...
//     → Token is in URL hash fragment
//
// Both cases are handled below.

import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Read from both locations — one will be populated depending on the flow
    const hash        = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = searchParams.get('access_token') || hash.get('access_token')
    const error       = searchParams.get('error')        || hash.get('error')

    if (error) {
      console.error('OAuth error:', error)
      navigate('/login')
      return
    }

    if (accessToken) {
      // Store the token in the Base44 SDK — this establishes the authenticated session
      base44.auth.setToken(accessToken)
      // Hard redirect (not navigate()) — forces AuthContext to re-initialize with the new token
      window.location.href = '/'
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

> Example authenticated home page. Replace the contents with your app's actual home screen.

```jsx
// src/pages/Home.jsx
// Authenticated home page — only reachable if the user is signed in (enforced by ProtectedRoute).
// Replace this with your actual app content.

import { useEffect, useState } from 'react'
import { base44 } from '@/api/base44Client'

export default function Home() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Fetch current user profile from Base44
    base44.auth.me().then(setUser).catch(() => {})
  }, [])

  const handleLogout = () => {
    // Clears token and redirects to /login
    base44.auth.logout('/login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 gap-6">

      {/* User avatar and info */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
          {user?.full_name?.[0] || user?.email?.[0] || '?'}
        </div>
        <h1 className="text-xl font-bold font-heading text-foreground">
          {user?.full_name || 'Welcome!'}
        </h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Sign out */}
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

> ✏️ **Add your own pages** in the two places marked below.

```jsx
// src/App.jsx
// Application router. All providers live here — do not remove any of them.
//
// Route structure:
//   /login   → Login page (public)
//   /auth    → OAuth callback (public — receives token from Google)
//   /        → Home page (protected — redirects to /login if not authenticated)
//   ✏️ Add more protected routes inside the ProtectedRoute block below

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

// ✏️ Import your own pages here:
// import Dashboard from '@/pages/Dashboard';
// import Profile from '@/pages/Profile';

function App() {
  return (
    // AuthProvider: manages user auth state for the entire app
    <AuthProvider>
      {/* QueryClientProvider: enables base44.entities.* data fetching */}
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          {/* ScrollToTop: resets scroll on route change */}
          <ScrollToTop />
          <Routes>

            {/* ── Public routes (no auth required) ───────────────── */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth"  element={<Auth />} />   {/* OAuth callback */}

            {/* ── Protected routes (auth required) ───────────────── */}
            {/* ProtectedRoute checks AuthContext — redirects to /login if not authenticated */}
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/" element={<Home />} />

              {/* ✏️ Add your own protected pages here: */}
              {/* <Route path="/dashboard" element={<Dashboard />} /> */}
              {/* <Route path="/profile"   element={<Profile />} /> */}
            </Route>

            {/* Catch-all — redirect unknown routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </Router>
        {/* Toaster: renders toast notifications app-wide */}
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` from Google | URI in Google Console doesn't exactly match | Must be `https://YOUR-APP.base44.app/native-callback.html` — exact match, no trailing slash, https only |
| `/native-callback.html` returns 404 | File is in wrong location | Must be in `public/` folder (not `src/`) — Vite serves `public/` as-is |
| Deeplink not intercepted by Despia | Scheme not registered | Add scheme + `oauth/auth` path in Despia project settings |
| Spinner loops forever on `/auth` | Token not being read | Open browser console — check for errors on `searchParams` or `hash` parsing |
| `GOOGLE_CLIENT_ID secret not set` | Secret missing | Add in Base44 dashboard → Settings → Environment Variables |
| Works on web but not in Despia | `isDespia` check failing | Log `navigator.userAgent` on device — confirm it contains "despia" |
| Token set but user appears logged out | Auth provider not reinitializing | `Auth.jsx` must use `window.location.href = '/'` not `navigate('/')` — the hard redirect is required |
| User sees "Access Restricted" screen | User not registered in this Base44 app | The Google account exists but isn't registered for this specific app — contact app admin |

---

## What to Customise (Only 2 Things)

Search for `✏️` in the files above:

1. **`src/pages/Login.jsx`** → Change `'myapp'` to your Despia deeplink scheme
2. **`src/App.jsx`** → Add your own page imports and routes inside the ProtectedRoute block

Everything else is boilerplate that works as-is.