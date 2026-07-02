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

  // The path the deep link opens inside the app. Keep in sync with:
  //   - the route in src/App.jsx ("/oauth/auth")
  //   - the "Allowed path" you register in Despia ("oauth/auth")
  // Most projects never need to change this.
  deeplinkPath: 'oauth/auth',
}

// Full deep link Despia sends back into the app, e.g. "myapp://oauth/auth".
export const deeplinkTarget = appConfig.deeplinkScheme + '://' + appConfig.deeplinkPath