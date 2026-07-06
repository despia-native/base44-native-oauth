import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureIncomingToken, hasPendingToken } from '@/lib/deeplinkToken'
import despia from 'despia-native'

// Our layout is a fixed full-height frame that handles the keyboard itself —
// disable the native WebView resize/reposition on keyboard open so the view
// never shifts and no white gap appears below the keyboard.
if (navigator.userAgent.toLowerCase().includes('despia')) {
  despia('preventdefault://autoscroll?enabled=false')
}

// A native deep-link can reopen the app with the OAuth token on ANY path — and the
// static host may collapse "/oauth/auth?token=..." down to "/" before React boots,
// which would hit the protected root and bounce to /login before the token is read.
//
// So: read the token from wherever it landed (query/hash), and if there is one,
// stash it and force the URL to /auth (a public route) BEFORE React mounts, so the
// route guard never sees a token-bearing visit as an unauthenticated "/" hit.
const onAuthPath = window.location.pathname === '/auth' || window.location.pathname === '/oauth/auth'
if (hasPendingToken()) {
  captureIncomingToken()
  window.history.replaceState(null, '', '/auth')
} else if (!onAuthPath) {
  captureIncomingToken()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)