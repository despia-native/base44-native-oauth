import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'
import * as customAuth from '@/lib/customAuth'
import { signInWithDevice, isNative } from '@/lib/deviceAuth'
import { haptics } from '@/lib/haptics'
import { appConfig } from '@/config/app-config'

const isDespia = isNative()

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Loginless native flow: auto sign-in as a device-backed guest.
  const [autoSignIn, setAutoSignIn] = useState(isDespia)

  useEffect(() => {
    if (!isDespia) return
    let cancelled = false
    signInWithDevice()
      .then(() => { if (!cancelled) window.location.href = '/' })
      .catch(() => { if (!cancelled) setAutoSignIn(false) }) // fall back to the normal form
    return () => { cancelled = true }
  }, [])

  const handleFaceIdSignIn = async () => {
    setError('')
    setAutoSignIn(true)
    try {
      await signInWithDevice({ biometric: true })
      window.location.href = '/'
    } catch (err) {
      setAutoSignIn(false)
      setError(err?.response?.data?.error || err?.message || 'Face ID sign-in failed')
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    // Both web and native get a Google access token, then exchange it for our own JWT on /auth.
    const res = await base44.functions.invoke('googleAuthUrl', { deeplink_scheme: appConfig.deeplinkScheme })
    const { url } = res.data
    if (isDespia) {
      despia(`oauth://?url=${encodeURIComponent(url)}`)
    } else {
      window.location.href = url
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    haptics.heavy()
    try {
      if (mode === 'register') {
        await customAuth.register({ email, password, full_name: fullName })
      } else {
        await customAuth.login({ email, password })
      }
      haptics.success()
      window.location.href = '/'
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Something went wrong'
      haptics.error()
      setError(msg)
      setLoading(false)
    }
  }

  if (autoSignIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 gap-4">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Setting up your session…</p>
      </div>
    )
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
          <h1 className="text-2xl font-bold font-heading text-foreground">
            {mode === 'register' ? 'Create account' : 'Welcome'}
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            {mode === 'register' ? 'Sign up to get started' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          {mode === 'login' && (
            <Link to="/forgot-password" className="text-xs text-muted-foreground self-end -mt-1">
              Forgot password?
            </Link>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
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
          Continue with Google
        </button>

        {isDespia && (
          <button
            type="button"
            onClick={handleFaceIdSignIn}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-lg px-4 py-3 bg-background hover:bg-muted transition-colors text-sm font-medium text-foreground shadow-sm"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2-2v-2" />
              <path d="M9 9h.01M15 9h.01M9.5 15a3.5 3.5 0 0 0 5 0M12 9v4" />
            </svg>
            Continue as guest with Face ID
          </button>
        )}

        <button
          type="button"
          onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}
          className="text-xs text-muted-foreground"
        >
          {mode === 'register' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}