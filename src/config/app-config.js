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

  // The path the deep link opens inside the app — set it WITHOUT the "oauth/" prefix.
  // ⚠️ Despia always prepends "oauth/" to the scheme, so the real deep link is
  // always  <scheme>://oauth/<deeplinkPath>. Set this to just "auth" and we add
  // "oauth/" for you. It stays in sync with:
  //   - the route in src/App.jsx ("/oauth/auth")
  //   - the "Allowed path" in Despia
  // Most projects never need to change this.
  deeplinkPath: 'auth',
}

// Full deep link Despia sends back into the app, e.g. "myapp://oauth/auth".
// Despia always prepends "oauth/", so we build it explicitly here.
export const deeplinkTarget = appConfig.deeplinkScheme + '://oauth/' + appConfig.deeplinkPath