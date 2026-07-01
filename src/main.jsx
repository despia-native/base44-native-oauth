import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { captureIncomingToken, hasPendingToken } from '@/lib/deeplinkToken'

// A native deep-link can reopen the app with the OAuth token on ANY path.
const onAuthPath = window.location.pathname === '/auth' || window.location.pathname === '/oauth/auth'
// On an auth path, leave the URL untouched so <Auth /> can read the live hash token itself.
// On any other path, capture+stash the token and route to /auth to process it.
if (!onAuthPath) {
  captureIncomingToken()
  if (hasPendingToken()) {
    window.history.replaceState(null, '', '/auth')
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)