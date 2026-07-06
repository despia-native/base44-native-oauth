import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as customAuth from '@/lib/customAuth'
import { useAuth } from '@/lib/AuthContext'
import { readFromUrl, consumePendingToken } from '@/lib/deeplinkToken'

// The token may have been stashed at boot (captured from the deep-link before
// React mounted) OR still be sitting in the live URL. Check both.
function extractFromUrl() {
  const stashed = consumePendingToken()
  if (stashed.token || stashed.idToken || stashed.code || stashed.error) return stashed
  return readFromUrl()
}

export default function Auth() {
  const navigate = useNavigate()
  const { checkUserAuth } = useAuth()
  const [status, setStatus] = useState('Signing you in...')
  const [ready, setReady] = useState(false) // set once login succeeds; user taps Continue
  const handledRef = useRef(false)

  useEffect(() => {
    const handleToken = ({ code, idToken }) => {
      if (handledRef.current) return
      handledRef.current = true
      setStatus('Verifying your account...')
      // Link mode: attach the Google identity to the current anonymous account
      // (set by the "Protect your account" flow) instead of a fresh sign-in.
      const linkMode = localStorage.getItem('google_link_mode') === '1'
      localStorage.removeItem('google_link_mode')
      const authPromise = idToken
        ? customAuth.loginWithAppleToken(idToken) // Apple (Android deeplink flow)
        : linkMode
          ? customAuth.linkWithGoogleCode(code)
          : customAuth.loginWithGoogleCode(code)
      authPromise
        .then(async () => {
          await checkUserAuth()
          setStatus('Signed in! Tap Continue to enter the app.')
          setReady(true)
        })
        .catch((err) => {
          const msg = err?.response?.data?.error || err?.message || 'Unknown error'
          setStatus('Sign-in failed: ' + msg)
          setTimeout(() => navigate('/login'), 3000)
        })
    }

    const tryExtract = () => {
      if (handledRef.current) return true
      const { idToken, code, error } = extractFromUrl()
      if (error) {
        handledRef.current = true
        setStatus('Sign-in error: ' + error)
        setTimeout(() => navigate('/login'), 3000)
        return true
      }
      if (code || idToken) {
        handleToken({ code, idToken })
        return true
      }
      return false
    }

    // Check immediately on mount...
    if (tryExtract()) return

    // ...but in the native WebView the token arrives via a later history URL change
    // (the page is NOT reloaded), so keep observing until it shows up.
    window.addEventListener('popstate', tryExtract)
    window.addEventListener('hashchange', tryExtract)
    const poll = setInterval(tryExtract, 300)

    // Give up after ~15s if nothing ever arrives.
    const giveUp = setTimeout(() => {
      if (!handledRef.current) {
        setStatus('No sign-in token received.')
        setTimeout(() => navigate('/login'), 3000)
      }
    }, 15000)

    return () => {
      window.removeEventListener('popstate', tryExtract)
      window.removeEventListener('hashchange', tryExtract)
      clearInterval(poll)
      clearTimeout(giveUp)
    }
  }, [navigate, checkUserAuth])

  return (
    <div className="flex flex-col h-full items-center justify-center bg-background px-6 gap-6 pt-safe-top pb-safe-bottom">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-[15px] text-muted-foreground text-center">{status}</p>
      </div>

      {ready && (
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="w-full max-w-sm h-14 rounded-full ember-primary text-[16px] font-bold active:scale-95 transition-transform"
        >
          Continue to App
        </button>
      )}
    </div>
  )
}