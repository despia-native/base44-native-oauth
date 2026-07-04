// ─────────────────────────────────────────────────────────────────────────────
// 🔧 TEMPLATE CONFIG — EDIT THIS FILE FIRST when you clone this template.
// This is the ONE place for per-project frontend settings. Change these values,
// then follow /TEMPLATE_SETUP.md for the matching secrets + Google/Despia steps.
// ─────────────────────────────────────────────────────────────────────────────

export const appConfig = {
  // Your Despia custom deep-link scheme (NO "://", just the word).
  // Must match the scheme you register in Despia project settings.
  // Example: if your deep link is  myapp://oauth/auth  →  set this to 'myapp'.
  deeplinkScheme: 'myapp',

  // The path the deep link RE-OPENS inside the WebView app — set it WITHOUT the "oauth/" prefix.
  //
  // ⚠️ Two different "oauth" things — don't confuse them:
  //   1. oauth:// (native handler)  → Despia's built-in bridge that opens the secure
  //      in-app browser to RUN Google sign-in. This is native code, not a route in your app.
  //   2. <scheme>://oauth/auth (deep link) → how the native shell RE-OPENS the WebView at
  //      your "/oauth/auth" route to CLOSE the session (hand the token back → mint the JWT).
  //
  // Despia always prepends "oauth/" to the scheme for the deep link, so the real value is
  // always  <scheme>://oauth/<deeplinkPath>. Set this to just "auth" and we add "oauth/"
  // for you. It stays in sync with:
  //   - the route in src/App.jsx ("/oauth/auth")
  //   - the "Allowed path" in Despia
  // Most projects never need to change this.
  deeplinkPath: 'auth',

  // 🔧 TEMPLATE: your Apple "Sign In with Apple" Services ID (public client id),
  // e.g. 'com.yourcompany.yourapp.webauth' — created in Apple Developer Console →
  // Identifiers → Services IDs. Must match the value in the appleSignIn and
  // appleAuthUrl backend functions (APPLE_SERVICES_ID secret or their fallback).
  appleServicesId: 'com.yourcompany.yourapp.webauth',
}

// Full deep link Despia sends back into the WebView, e.g. "myapp://oauth/auth".
// (This is #2 above — the deep link that reopens the app, NOT the native oauth:// handler.)
// Despia always prepends "oauth/", so we build it explicitly here.
export const deeplinkTarget = appConfig.deeplinkScheme + '://oauth/' + appConfig.deeplinkPath