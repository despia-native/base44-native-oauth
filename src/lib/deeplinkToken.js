// Captures an OAuth token that arrives via a native deep-link.
//
// When Despia reopens the app with `myapp://auth?access_token=...`, the token
// can land on ANY path (often "/") and the WebView may not reload the page.
// We grab it as early as possible, stash it in sessionStorage so it survives
// route changes, and clean it out of the visible URL.

const KEY = 'pending_oauth'

function parse(str) {
  try { return new URLSearchParams(str || '') } catch { return new URLSearchParams() }
}

// Read token/error from the current URL (query OR hash) without consuming it.
export function readFromUrl() {
  const query = parse(window.location.search.replace(/^\?/, ''))
  const hash = parse(window.location.hash.replace(/^#/, ''))
  const token =
    query.get('token') || query.get('access_token') ||
    hash.get('token') || hash.get('access_token')
  const idToken = query.get('id_token') || hash.get('id_token') // Apple
  const error = query.get('error') || hash.get('error')
  return { token: token || null, idToken: idToken || null, error: error || null }
}

// Called once at startup, before React mounts. Stashes any incoming token and
// strips it from the URL so it isn't left lying around.
export function captureIncomingToken() {
  const { token, idToken, error } = readFromUrl()
  if (token || idToken || error) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ token, idToken, error })) } catch { /* ignore */ }
    // Remove the sensitive params from the visible URL, keep the pathname.
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch { /* ignore */ }
  }
}

// Consume the stashed token (returns once, then clears it).
export function consumePendingToken() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return { token: null, idToken: null, error: null }
    sessionStorage.removeItem(KEY)
    return JSON.parse(raw)
  } catch {
    return { token: null, idToken: null, error: null }
  }
}

// True if we have a token waiting (URL or stash) — used to route to /auth.
export function hasPendingToken() {
  if (sessionStorage.getItem(KEY)) return true
  const { token, idToken, error } = readFromUrl()
  return !!(token || idToken || error)
}