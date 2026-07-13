import { useState } from 'react'
import { Link } from 'react-router-dom'
import F7Icon from '@/components/F7Icon'
import * as customAuth from '@/lib/customAuth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // Always show generic success — never reveal whether the email exists.
    await customAuth.requestPasswordReset(email).catch(() => {})
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <header className="shrink-0 pt-safe-top bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="h-11 flex items-center px-2">
          <Link to="/login" className="flex items-center text-primary text-[17px] active:opacity-60">
            <F7Icon name="chevron_left" size={22} className="-ml-1" /> Back
          </Link>
        </div>
      </header>

      <div className="scroll-container flex flex-col items-center px-5 pb-safe-bottom">
        <div className="w-full max-w-sm md:max-w-md flex flex-col items-center pt-10">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <F7Icon name="lock_open_fill" size={26} className="text-primary" />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground text-center">Reset Password</h1>
          <p className="mt-2 text-[15px] text-muted-foreground text-center">
            {sent ? 'Check your inbox for a reset link.' : "Enter your email and we'll send you a reset link."}
          </p>

          {sent ? (
            <div role="status" className="mt-8 w-full rounded-3xl ember-card px-4 py-4">
              <p className="text-[15px] text-muted-foreground text-center">
                If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link is on its way. The link expires in 30 minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 w-full flex flex-col gap-4">
              <input
                type="email"
                required
                aria-label="Email"
                autoComplete="email"
                inputMode="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ember-input"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full ember-primary text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-40"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}