# Native Google OAuth — Base44 + Despia

**Copy-paste this entire guide into any Base44 project to add native Google Sign-In for Despia-wrapped mobile apps.**

---

## What This Does

When your Base44 web app is wrapped in Despia as a native app, standard Google OAuth breaks because redirects open an external browser and the token never returns. This setup uses Despia's `oauth://` bridge to open Google Sign-In in a secure in-app browser and return the token via a deeplink.

```
User taps "Sign in with Google"
    │
    ▼ (inside Despia)
Login.jsx calls Base44 backend → googleAuthUrl function
    │
    ▼
despia('oauth://?url=<google-auth-url>')
Despia opens in-app browser → Google Sign-In page
    │
    ▼
User signs in
Google redirects to → /native-callback.html?deeplink_scheme=myapp#access_token=ya29...
    │
    ▼
native-callback.html reads token from hash
Fires deeplink → myapp://oauth/auth?access_token=ya29...
    │
    ▼
Despia intercepts deeplink → WebView navigates to /auth?access_token=ya29...
    │
    ▼
Auth.jsx calls base44.auth.setToken(token) → hard redirect to /
    │
    ▼
✅ Logged in
```

On **web** (non-Despia): uses Base44's built-in `loginWithProvider('google')` — no extra setup needed.

---

## Required npm Package

```bash
npm install despia-native
```

---

## Files to Create / Replace

| File | Action |
|---|---|
| `public/native-callback.html` | CREATE — static bridge page |
| `base44/functions/googleAuthUrl/entry.ts` | CREATE — backend function |
| `src/pages/Login.jsx` | REPLACE — login page |
| `src/pages/Auth.jsx` | REPLACE — token callback |
| `src/pages/Home.jsx` | REPLACE — authenticated home |
| `src/lib/AuthContext.jsx` | CREATE — auth context provider |
| `src/components/ProtectedRoute.jsx` | CREATE — route guard |
| `src/components/UserNotRegisteredError.jsx` | CREATE — error boundary |
| `src/api/base44Client.js` | CREATE — Base44 SDK client |
| `src/lib/app-params.js` | CREATE — app config |
| `src/App.jsx` | REPLACE — router |

---

## Step 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID** → Application type: **Web application**
3. Under **Authorized redirect URIs** add:
   ```
   https://YOUR-APP.base44.app/native-callback.html
   ```
   > Replace `YOUR-APP` with your Base44 subdomain (visible in your published app URL)
4. Copy your **Client ID** and **Client Secret**

## Step 2 — Base44 Secrets

Dashboard → **Settings** → **Environment Variables**:

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxx` |

## Step 3 — Update Your Deeplink Scheme

Search the codebase for `myapp` and replace with your Despia app's actual deeplink scheme (configured in your Despia project settings).

## Step 4 — Despia Project Settings

In Despia, register:
- Scheme: `myapp` (or your scheme)
- Allowed deeplink path: `oauth/auth`

---

## Complete File Contents

### `public/native-callback.html`

> Must be in `public/` — served as a static file, NOT through React Router.

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
      var scheme      = params.get('deeplink_scheme')
      if (!scheme) { document.body.innerText = 'Error: missing deeplink_scheme'; return }

      // Google implicit flow puts the token in the URL hash
      var hash        = new URLSearchParams(window.location.hash.substring(1))
      var accessToken = hash.get('access_token')
      var error       = hash.get('error') || params.get('error')

      if (!accessToken) {
        window.location.href = scheme + '://oauth/auth?error=' + encodeURIComponent(error || 'no_access_token')
        return
      }

      // Fire deeplink — Despia intercepts this and routes the WebView to /auth?access_token=...
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

> Base44 backend function. Reads `GOOGLE_CLIENT_ID` from secrets. Deploy via Base44 dashboard or CLI.

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

    // Redirect URI must exactly match what's registered in Google Cloud Console
    const redirectUri =
      `https://${req.headers.get('host')}/native-callback.html` +
      `?deeplink_scheme=${encodeURIComponent(deeplink_scheme)}`;

    // Implicit flow: Google returns access_token in the URL hash
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid email profile',
    });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

### `src/api/base44Client.js`

```js
import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
```

---

### `src/lib/app-params.js`

```js
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
    try { localStorage.setItem(name, value); } catch {}
    // Remove from URL without reload
    urlParams.delete(name);
    urlParams.delete(camelName);
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
    return value;
  }

  try { value = localStorage.getItem(name); } catch {}
  return value || defaultValue;
}

export const appParams = {
  appId: getParam('app_id', import.meta.env.VITE_BASE44_APP_ID),
  token: getParam('token'),
  functionsVersion: getParam('functions_version'),
  appBaseUrl: getParam('app_base_url', import.meta.env.VITE_BASE44_APP_BASE_URL),
};
```

---

### `src/lib/AuthContext.jsx`

```jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true
      });

      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);

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
          const reason = appError.data.extra_data.reason;
          setAuthError({ type: reason, message: appError.message });
        } else {
          setAuthError({ type: 'unknown', message: appError.message || 'Failed to load app' });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
```

---

### `src/components/ProtectedRoute.jsx`

```jsx
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) return fallback;

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    return unauthenticatedElement;
  }

  if (!isAuthenticated) return unauthenticatedElement;

  return <Outlet />;
}
```

---

### `src/components/UserNotRegisteredError.jsx`

```jsx
export default function UserNotRegisteredError() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your account is not registered for this app. Please contact the app administrator.
        </p>
        <button
          onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
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

### `src/pages/Login.jsx`

> ✏️ Replace `myapp` with your Despia deeplink scheme.

```jsx
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'

// Detect if running inside Despia native wrapper
const isDespia = navigator.userAgent.toLowerCase().includes('despia')

export default function Login() {
  const handleGoogleSignIn = async () => {
    if (isDespia) {
      // NATIVE: Call backend to build Google OAuth URL (keeps Client ID off frontend)
      // Then tell Despia to open it in a secure in-app browser
      const res = await base44.functions.invoke('googleAuthUrl', {
        deeplink_scheme: 'myapp'  // ✏️ Replace with your Despia deeplink scheme
      })
      const { url } = res.data
      despia(`oauth://?url=${encodeURIComponent(url)}`)
    } else {
      // WEB: Use Base44's built-in Google OAuth
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

```jsx
import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Native deeplink: token arrives as ?access_token= query param
    // Web loginWithProvider: token arrives in URL hash #access_token=
    const hash        = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = searchParams.get('access_token') || hash.get('access_token')
    const error       = searchParams.get('error')        || hash.get('error')

    if (error) {
      console.error('Auth error:', error)
      navigate('/login')
      return
    }

    if (accessToken) {
      base44.auth.setToken(accessToken)
      window.location.href = '/'  // Hard redirect to re-initialize auth provider
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
import ScrollToTop from './components/ScrollToTop';
import Login from '@/pages/Login';
import Auth from '@/pages/Auth';
import Home from '@/pages/Home';

// ✏️ Add your own pages here
// import MyPage from '@/pages/MyPage';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth"  element={<Auth />} />

            {/* Protected routes — redirects to /login if not authenticated */}
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/" element={<Home />} />
              {/* ✏️ Add your protected pages here: */}
              {/* <Route path="/mypage" element={<MyPage />} /> */}
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

### `src/lib/query-client.js`

```js
import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

---

### `src/components/ScrollToTop.jsx`

```jsx
import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;
    if (hash) {
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

## Troubleshooting

| Symptom | Fix |
|---|---|
| `redirect_uri_mismatch` from Google | The URI in Google Console must **exactly** match: `https://YOUR-APP.base44.app/native-callback.html` — no trailing slash, must be https |
| `/native-callback.html` returns 404 | File must be in `public/` folder, not `src/` |
| Deeplink not intercepted by Despia | Register the scheme in Despia project settings with `oauth/auth` as an allowed path |
| Spinner loops forever after sign-in | Check browser console — likely `setToken` failing or `/auth` route missing from App.jsx |
| `GOOGLE_CLIENT_ID secret not set` | Add it in Base44 dashboard → Settings → Environment Variables |
| Works on web but not native | Confirm `navigator.userAgent` contains `despia` on device — check with `console.log(navigator.userAgent)` |

---

## What to Customise

Search for `✏️` in the files above — there are only 2 things to change:

1. **`src/pages/Login.jsx`** line: `deeplink_scheme: 'myapp'` → your scheme
2. **`src/App.jsx`** — add your own pages under the protected route block