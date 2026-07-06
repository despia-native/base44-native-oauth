import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Layers, Cloud, ShieldCheck, Mail } from 'lucide-react'
import AppleIcon from '@/components/AppleIcon'
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'
import * as customAuth from '@/lib/customAuth'
import { signInWithDevice, isNative } from '@/lib/deviceAuth'
import { signInWithApple } from '@/lib/appleAuth'
import { appConfig } from '@/config/app-config'
import GoogleIcon from '@/components/GoogleIcon'
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel'
import SavedAccountRow from '@/components/onboarding/SavedAccountRow'
import SavedAccountCard from '@/components/onboarding/SavedAccountCard'
import AccountPickerDrawer from '@/components/onboarding/AccountPickerDrawer'
import { loadSavedAccounts, removeSavedAccount } from '@/lib/savedAccounts'
import PoweredByDespia from '@/components/PoweredByDespia'

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
  const [error, setError] = useState('')
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

  if (autoSignIn) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background px-6 gap-4 pt-safe-top pb-safe-bottom">
        <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-[15px] text-muted-foreground">Setting up your session…</p>
      </div>
    )
  }

  /* ── Onboarding view ────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full bg-background pt-safe-top pb-safe-bottom">
      {/* Value-prop carousel fills the middle */}
      <div className="flex-1 flex items-center min-h-0 w-full max-w-lg mx-auto">
        <OnboardingCarousel slides={SLIDES} />
      </div>

      {/* Bottom CTA stack */}
      <div className="w-full max-w-sm md:max-w-md mx-auto px-5 pb-6 flex flex-col gap-3">
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
              onClick={() => navigate('/login/email')}
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
        <PoweredByDespia />
      </div>

      <AccountPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        savedAccounts={savedAccounts}
        onSelectSaved={(a) => { setPickerOpen(false); handleSavedAccount(a) }}
        onRemoveSaved={handleRemoveSaved}
        onGoogle={() => { setPickerOpen(false); handleGoogleSignIn() }}
        onApple={() => { setPickerOpen(false); handleAppleSignIn() }}
        onEmail={() => { setPickerOpen(false); navigate('/login/email') }}
      />
    </div>
  )
}