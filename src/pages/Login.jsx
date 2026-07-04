import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Layers, Cloud, ShieldCheck, Mail, Apple } from 'lucide-react'
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'
import * as customAuth from '@/lib/customAuth'
import { signInWithDevice, isNative } from '@/lib/deviceAuth'
import { signInWithApple } from '@/lib/appleAuth'
import { haptics } from '@/lib/haptics'
import { appConfig } from '@/config/app-config'
import GoogleIcon from '@/components/GoogleIcon'
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel'

const isDespia = isNative()

const SLIDES = [
  {
    icon: Layers,
    title: 'Everything in one place',
    body: 'Your account, your data, your settings — beautifully organized and always within reach.',
  },
  {
    icon: Cloud,
    title: 'Synced across devices',
    body: 'Start on your phone, pick up anywhere. Your session follows you securely on every device.',
  },
  {
    icon: ShieldCheck,
    title: 'Private & secure',
    body: 'Sign in with Google, email, or just your device. Your data stays yours — encrypted end to end.',
  },
]

export default function Login() {
  const [view, setView] = useState('onboarding') // 'onboarding' | 'email'
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
      .catch(() => { if (!cancelled) setAutoSignIn(false) }) // fall back to onboarding
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

  const handleAppleSignIn = async () => {
    setError('')
    try {
      const result = await signInWithApple()
      if (!result) return // Android: sign-in continues via the deeplink → /auth flow
      await customAuth.loginWithAppleToken(result.idToken, result.fullName)
      window.location.href = '/'
    } catch (err) {
      if (err?.error === 'popup_closed_by_user') return
      setError(err?.response?.data?.error || err?.message || 'Apple sign-in failed')
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
      <div className="flex flex-col h-full items-center justify-center bg-background px-6 gap-4 pt-safe-top pb-safe-bottom">
        <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-[15px] text-muted-foreground">Setting up your session…</p>
      </div>
    )
  }

  /* ── Email sign-in / register view ─────────────────────────── */
  if (view === 'email') {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="scroll-container flex flex-col px-5 pt-safe-top pb-safe-bottom">
          <button
            type="button"
            onClick={() => { setView('onboarding'); setError('') }}
            className="flex items-center text-primary text-[17px] active:opacity-60 self-start mt-4 -ml-1"
          >
            <ChevronLeft className="w-6 h-6" /> Back
          </button>

          <div className="w-full max-w-sm mx-auto flex flex-col items-center pt-8 pb-10">
            <h1 className="text-[26px] font-bold tracking-tight text-foreground mb-1">
              {mode === 'register' ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-[15px] text-muted-foreground mb-8">
              {mode === 'register' ? 'Sign up to get started' : 'Sign in to continue'}
            </p>

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {mode === 'register' && (
                  <input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="ember-input"
                  />
                )}
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="ember-input"
                />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ember-input"
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
                className="w-full h-14 rounded-full ember-primary text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-40"
              >
                {loading ? 'Please wait…' : mode === 'register' ? 'Create Account' : 'Sign In'}
              </button>
            </form>

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

  /* ── Onboarding view ────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full bg-background pt-safe-top pb-safe-bottom">
      {/* Value-prop carousel fills the middle */}
      <div className="flex-1 flex items-center min-h-0">
        <OnboardingCarousel slides={SLIDES} />
      </div>

      {/* Bottom CTA stack */}
      <div className="w-full max-w-sm mx-auto px-5 pb-6 flex flex-col gap-3">
        {error && <p className="text-[13px] text-destructive text-center">{error}</p>}

        <button
          onClick={handleGoogleSignIn}
          className="w-full h-14 flex items-center justify-center gap-3 rounded-full ember-primary active:scale-95 transition-transform text-[16px] font-bold"
        >
          <GoogleIcon className="w-5 h-5" />
          Continue with Google
        </button>

        <button
          type="button"
          onClick={handleAppleSignIn}
          className="w-full h-14 flex items-center justify-center gap-3 rounded-full ember-glass ember-press active:scale-95 transition-transform text-[16px] font-semibold text-foreground"
        >
          <Apple className="w-5 h-5 fill-current" />
          Continue with Apple
        </button>

        <button
          type="button"
          onClick={() => { setView('email'); setError('') }}
          className="w-full h-14 flex items-center justify-center gap-3 rounded-full ember-glass ember-press active:scale-95 transition-transform text-[16px] font-semibold text-foreground"
        >
          <Mail className="w-5 h-5" />
          Continue with Email
        </button>

        {isDespia && (
          <button
            type="button"
            onClick={handleFaceIdSignIn}
            className="w-full h-12 text-[15px] font-medium text-muted-foreground active:opacity-60"
          >
            Continue as guest
          </button>
        )}

        <p className="text-center text-[12px] text-muted-foreground/70 px-6 mt-1">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}