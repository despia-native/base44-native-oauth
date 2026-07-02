import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'
import * as customAuth from '@/lib/customAuth'
import { signInWithDevice, isNative } from '@/lib/deviceAuth'
import { haptics } from '@/lib/haptics'
import { appConfig } from '@/config/app-config'
import GoogleIcon from '@/components/GoogleIcon'

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

  const inputClass = 'w-full bg-transparent px-4 py-3.5 text-[15px] text-foreground placeholder:text-muted-foreground outline-none'

  if (autoSignIn) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-muted/40 px-6 gap-4 pt-safe-top pb-safe-bottom">
        <div className="w-8 h-8 border-[3px] border-border border-t-foreground rounded-full animate-spin" />
        <p className="text-[15px] text-muted-foreground">Setting up your session…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-muted/40">
      <div className="scroll-container flex flex-col items-center justify-center px-5 pt-safe-top pb-safe-bottom">
        <div className="w-full max-w-sm flex flex-col items-center py-10">
          {/* App mark + title */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-[72px] h-[72px] rounded-[18px] bg-primary flex items-center justify-center shadow-md">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-foreground">
              {mode === 'register' ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-[15px] text-muted-foreground text-center -mt-1">
              {mode === 'register' ? 'Sign up to get started' : 'Sign in to continue'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            {/* Grouped inputs — iOS inset style */}
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden shadow-sm divide-y divide-border/60">
              {mode === 'register' && (
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              )}
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p className="text-[13px] text-destructive px-1">{error}</p>}

            {mode === 'login' && (
              <Link to="/forgot-password" className="text-[13px] text-primary self-end px-1 -mt-1">
                Forgot password?
              </Link>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-3.5 text-[16px] font-semibold active:opacity-80 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Please wait…' : mode === 'register' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="w-full flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border/70" />
            <span className="text-[12px] text-muted-foreground uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-border/70" />
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3.5 bg-card border border-border/60 active:bg-muted/60 transition-colors text-[16px] font-medium text-foreground shadow-sm"
            >
              <GoogleIcon className="w-5 h-5" />
              Continue with Google
            </button>

            {isDespia && (
              <button
                type="button"
                onClick={handleFaceIdSignIn}
                className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3.5 bg-card border border-border/60 active:bg-muted/60 transition-colors text-[16px] font-medium text-foreground shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2-2v-2" />
                  <path d="M9 9h.01M15 9h.01M9.5 15a3.5 3.5 0 0 0 5 0M12 9v4" />
                </svg>
                Continue as guest with Face ID
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}
            className="mt-8 text-[14px] text-muted-foreground"
          >
            {mode === 'register'
              ? <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
              : <>Don't have an account? <span className="text-primary font-medium">Sign up</span></>}
          </button>
        </div>
      </div>
    </div>
  )
}