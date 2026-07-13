import { useState } from 'react'
import { Link } from 'react-router-dom'
import F7Icon from '@/components/F7Icon'
import despia from 'despia-native'
import { base44 } from '@/api/base44Client'
import * as customAuth from '@/lib/customAuth'
import { isNative } from '@/lib/deviceAuth'
import { appConfig } from '@/config/app-config'
import { signInWithApple } from '@/lib/appleAuth'
import GoogleIcon from '@/components/GoogleIcon'
import AppleIcon from '@/components/AppleIcon'

// Upgrade an anonymous device account to a real login (email/password or Google)
// while keeping all the data stored on the account.
export default function LinkAccount() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await customAuth.linkAccount({ email, password, full_name: fullName })
      window.location.href = '/account'
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const handleGoogleLink = async () => {
    setError('')
    // Flag so the /auth callback links the Google identity to THIS account
    // instead of signing into (or creating) a separate one.
    localStorage.setItem('google_link_mode', '1')
    const res = await base44.functions.invoke('googleAuthUrl', { deeplink_scheme: appConfig.deeplinkScheme })
    const { url } = res.data
    if (isNative()) {
      despia(`oauth://?url=${encodeURIComponent(url)}`)
    } else {
      window.location.href = url
    }
  }

  const handleAppleLink = async () => {
    setError('')
    // Flag so the /auth callback (Android deeplink flow) links the Apple
    // identity to THIS account instead of signing into a separate one.
    localStorage.setItem('apple_link_mode', '1')
    try {
      const result = await signInWithApple()
      if (!result) return // Android: linking continues via the deeplink → /auth flow
      // iOS/web popup: we have the token right here — link directly.
      localStorage.removeItem('apple_link_mode')
      await customAuth.linkWithAppleToken(result.idToken, result.fullName)
      window.location.href = '/account'
    } catch (err) {
      localStorage.removeItem('apple_link_mode')
      if (err?.error === 'popup_closed_by_user') return
      setError(err?.response?.data?.error || err?.message || 'Apple link failed')
    }
  }

  const inputClass = 'ember-input'

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="shrink-0 pt-safe-top bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="h-11 flex items-center px-2">
          <Link to="/account" className="flex items-center text-primary text-[17px] active:opacity-60">
            <F7Icon name="chevron_left" size={22} className="-ml-1" /> Back
          </Link>
        </div>
      </header>

      <div className="scroll-container flex flex-col items-center px-5 pb-safe-bottom">
        <div className="w-full max-w-sm md:max-w-md flex flex-col items-center pt-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <F7Icon name="checkmark_shield_fill" size={26} className="text-primary" />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground text-center">Protect Your Account</h1>
          <p className="mt-2 text-[15px] text-muted-foreground text-center leading-relaxed">
            Add a login to your guest account. All your data stays exactly where it is — you'll just be able to sign in from anywhere.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 w-full flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <input
                type="text"
                aria-label="Full name"
                autoComplete="name"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
              <input
                type="email"
                required
                aria-label="Email"
                autoComplete="email"
                inputMode="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                required
                aria-label="Password, minimum 8 characters"
                autoComplete="new-password"
                placeholder="Password (min. 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p role="alert" className="text-[13px] text-destructive px-1">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-full ember-primary text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-40"
            >
              {loading ? 'Linking…' : 'Add Email & Password'}
            </button>
          </form>

          <div className="w-full flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border/70" />
            <span className="text-[12px] text-muted-foreground uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-border/70" />
          </div>

          <button
            onClick={handleGoogleLink}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-full ember-glass ember-press active:scale-95 transition-transform text-[16px] font-semibold text-foreground mb-3"
          >
            <GoogleIcon className="w-5 h-5" />
            Link with Google
          </button>

          <button
            onClick={handleAppleLink}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-full ember-glass ember-press active:scale-95 transition-transform text-[16px] font-semibold text-foreground mb-10"
          >
            <AppleIcon className="w-5 h-5" />
            Link with Apple
          </button>
        </div>
      </div>
    </div>
  )
}