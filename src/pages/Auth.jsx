import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as customAuth from '@/lib/customAuth'
import { useAuth } from '@/lib/AuthContext'
import { readFromUrl, consumePendingToken } from '@/lib/deeplinkToken'

// The token may have been stashed at boot (captured from the deep-link before
// React mounted) OR still be sitting in the live URL. Check both.
function extractFromUrl() {
  const stashed = consumePendingToken()
  if (stashed.token || stashed.error) return stashed
  return readFromUrl()
}

export default function Auth() {
  const navigate = useNavigate()
  const { checkUserAuth } = useAuth()
  const [status, setStatus] = useState('Signing you in...')
  const handledRef = useRef(false)

  useEffect(() => {
    const handleToken = (token) => {
      if (handledRef.current) return
      handledRef.current = true
      setStatus('Verifying your account...')
      customAuth.loginWithGoogleToken(token)
        .then(async () => {
          await checkUserAuth()
          window.location.href = '/'
        })
        .catch((err) => {
          const msg = err?.response?.data?.error || err?.message || 'Unknown error'
          setStatus('Sign-in failed: ' + msg)
          setTimeout(() => navigate('/login'), 3000)
        })
    }

    const tryExtract = () => {
      if (handledRef.current) return true
      const { token, error } = extractFromUrl()
      if (error) {
        handledRef.current = true
        setStatus('Sign-in error: ' + error)
        setTimeout(() => navigate('/login'), 3000)
        return true
      }
      if (token) {
        handleToken(token)
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

  const currentUrl = window.location.href

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 gap-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground text-center">{status}</p>
      </div>

      {/* Debug: current URL + copy button */}
      <div className="w-full max-w-md flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">Current URL (debug)</span>
        <textarea
          readOnly
          value={currentUrl}
          rows={4}
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground font-mono break-all resize-none outline-none"
        />
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(currentUrl)}
          className="self-end px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Copy URL
        </button>
      </div>
    </div>
  )
}