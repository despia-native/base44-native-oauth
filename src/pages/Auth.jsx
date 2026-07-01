import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Signing you in...')
  const [debug, setDebug] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  useEffect(() => {
    // native-callback.html fires: myapp://oauth/auth?token=<google token>
    // Despia routes that to /auth?token=<google token>. Also accept access_token / hash as fallbacks.
    const hash        = new URLSearchParams(window.location.hash.substring(1))
    const provider    = searchParams.get('provider')     || hash.get('provider')
    const token       = searchParams.get('token')        || searchParams.get('access_token') || hash.get('access_token')
    const googleToken = provider === 'google' ? token : (provider ? null : token)
    const base44Token = searchParams.get('base44_token') || hash.get('base44_token')
    const error       = searchParams.get('error')        || hash.get('error')

    // Capture the full incoming URL so we can see what the native app actually delivered
    const info = {
      fullUrl: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
      hasGoogleToken: !!googleToken,
      hasBase44Token: !!base44Token,
      error: error || null,
    }
    setDebug(info)

    if (error) {
      setStatus('Sign-in error: ' + error)
      setTimeout(() => navigate('/login'), 4000)
      return
    }

    if (base44Token) {
      base44.auth.setToken(base44Token)
      window.location.href = '/'
      return
    }

    if (googleToken) {
      setStatus('Verifying your account...')
      base44.functions.invoke('googleSignIn', { google_token: googleToken })
        .then((res) => {
          const { access_token } = res.data
          if (!access_token) throw new Error('No access_token returned from server')
          base44.auth.setToken(access_token)
          window.location.href = '/'
        })
        .catch((err) => {
          const msg = err?.response?.data?.error || err?.message || 'Unknown error'
          setStatus('Sign-in failed: ' + msg)
        })
      return
    }

    // No token arrived at all — this is the "stuck forever" case.
    setStatus('No sign-in token received.')
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 max-w-md w-full">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground text-center">{status}</p>

        {debug && (
          <div className="w-full mt-4 flex flex-col gap-2">
            <label className="text-[11px] font-medium text-foreground">Current URL (copy this):</label>
            <textarea
              readOnly
              value={debug.fullUrl}
              onFocus={(e) => e.target.select()}
              rows={4}
              className="w-full rounded-lg border border-border bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground break-all font-mono resize-none"
            />
            <button
              onClick={handleCopy}
              className="w-full rounded-lg bg-primary text-primary-foreground text-xs font-medium px-4 py-2"
            >
              {copied ? 'Copied!' : 'Copy URL'}
            </button>

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground break-all font-mono">
              <div><span className="text-foreground">search:</span> {debug.search || '(empty)'}</div>
              <div><span className="text-foreground">hash:</span> {debug.hash || '(empty)'}</div>
              <div><span className="text-foreground">google token:</span> {debug.hasGoogleToken ? 'yes' : 'no'}</div>
              <div><span className="text-foreground">base44 token:</span> {debug.hasBase44Token ? 'yes' : 'no'}</div>
              {debug.error && <div><span className="text-foreground">error:</span> {debug.error}</div>}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/login')}
          className="mt-2 text-xs text-muted-foreground underline"
        >
          Back to sign in
        </button>
      </div>
    </div>
  )
}