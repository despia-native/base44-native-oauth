import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { ChevronLeft, Layers, Cloud, ShieldCheck, Mail } from 'lucide-react'
import AppleIcon from '@/components/AppleIcon'
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'
import * as customAuth from '@/lib/customAuth'
import { signInWithDevice, isNative } from '@/lib/deviceAuth'
import { signInWithApple } from '@/lib/appleAuth'
import { haptics } from '@/lib/haptics'
import { appConfig } from '@/config/app-config'
import GoogleIcon from '@/components/GoogleIcon'
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel'
import SavedAccountRow from '@/components/onboarding/SavedAccountRow'
import SavedAccountCard from '@/components/onboarding/SavedAccountCard'
import AccountPickerDrawer from '@/components/onboarding/AccountPickerDrawer'
import { loadSavedAccounts, removeSavedAccount } from '@/lib/savedAccounts'

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
  const navigate = useNavigate()
  const { checkUserAuth } = useAuth()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [view, setView] = useState('onboarding') // 'onboarding' | 'email'
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState([])
  // Prevents the sign-in buttons flashing before we know whether a saved
  // account exists — the CTA area stays empty until the list has loaded.
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  // SESSION MODEL: on native the app is ALWAYS usable — either logged in with a
  // real account (email/Google/Apple) or automatically as the device guest.
  // Guest is never an explicit choice, so auto sign-in always runs on native.
  const [autoSignIn, setAutoSignIn] = useState(isDespia)

  // SPA entry into the app — refresh auth state, then soft-navigate (no reload).
  const enterApp = async () => {
    await checkUserAuth()
    navigate('/', { replace: true })
  }

  useEffect(() => {
    // Guests never appear in the account picker — guest mode is automatic, not a choice.
    loadSavedAccounts().then((list) => {
      setSavedAccounts(list.filter((a) => !a.is_anonymous))
      setAccountsLoaded(true)
    })
    if (!isDespia) return
    let cancelled = false
    const signedOut = customAuth.wasSignedOut()
    signInWithDevice()
      .then((account) => {
        if (cancelled) return
        if (signedOut && !account.is_anonymous) {
          // The device account was LINKED to the very account the user just signed
          // out of — restoring it would silently undo the sign-out. Stay here and
          // let them pick an account explicitly.
          customAuth.logout()
          setAutoSignIn(false)
          return
        }
        // Distinct guest account (or no explicit sign-out) — enter as guest.
        enterApp()
      })
      .catch(() => { if (!cancelled) setAutoSignIn(false) }) // fall back to onboarding
    return () => { cancelled = true }
  }, [])

  // One-tap re-entry with an account previously used on this device.
  const handleSavedAccount = async (acct) => {
    setError('')
    setAutoSignIn(true)
    customAuth.setToken(acct.token)
    const account = await customAuth.fetchMe()
    if (account) {
      await enterApp()
      return
    }
    // Token expired or the account no longer exists — drop it from the device.
    removeSavedAccount(acct.id)
    setSavedAccounts((list) => list.filter((a) => a.id !== acct.id))
    setAutoSignIn(false)
    setError('That session expired — please sign in again.')
  }

  const handleRemoveSaved = (id) => {
    removeSavedAccount(id)
    setSavedAccounts((list) => list.filter((a) => a.id !== id))
  }

  const handleGoogleSignIn = async () => {
    setError('')
    // Both web and native get a Google access token, then exchange it for our own JWT on /auth.
    // Only native needs the deep-link hop — on the web the callback stays on this origin.
    const res = await base44.functions.invoke('googleAuthUrl', { deeplink_scheme: isDespia ? appConfig.deeplinkScheme : '' })
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
      await enterApp()
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
      await enterApp()
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
              <div key={error || 'ok'} className={`flex flex-col gap-3 ${error ? 'ember-shake' : ''}`}>
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

        {!accountsLoaded ? (
          /* Placeholder keeps the layout stable while the saved-account list loads */
          <div className="h-14" />
        ) : savedAccounts.length > 0 ? (
          <>
            {/* Device already has account(s) — iOS pattern: show WHO is continuing
                (avatar + name + email), then one-tap re-entry or the switcher. */}
            <SavedAccountCard account={savedAccounts[0]} />
            <button
              type="button"
              onClick={() => handleSavedAccount(savedAccounts[0])}
              className="w-full h-14 rounded-full ember-primary active:scale-95 transition-transform text-[16px] font-bold px-6"
            >
              Continue to account
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full h-14 rounded-full ember-glass ember-press active:scale-95 transition-transform text-[16px] font-semibold text-foreground"
            >
              Use another account
            </button>
          </>
        ) : (
          <>
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
              <AppleIcon className="w-5 h-5" />
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

          </>
        )}

        <p className="text-center text-[12px] text-muted-foreground/70 px-6 mt-1">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

      <AccountPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        savedAccounts={savedAccounts}
        onSelectSaved={(a) => { setPickerOpen(false); handleSavedAccount(a) }}
        onRemoveSaved={handleRemoveSaved}
        onGoogle={() => { setPickerOpen(false); handleGoogleSignIn() }}
        onApple={() => { setPickerOpen(false); handleAppleSignIn() }}
        onEmail={() => { setPickerOpen(false); setView('email'); setError('') }}
      />
    </div>
  )
}