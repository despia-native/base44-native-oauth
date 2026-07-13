import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import F7Icon from '@/components/F7Icon'
import * as customAuth from '@/lib/customAuth'

export default function ResetPassword() {
  const navigate = useNavigate()
  const resetToken = new URLSearchParams(window.location.search).get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await customAuth.resetPassword({ reset_token: resetToken, new_password: password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Something went wrong'
      setError(msg)
      setLoading(false)
    }
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
            {done
              ? <F7Icon name="checkmark_circle_fill" size={26} className="text-secondary" />
              : <F7Icon name="lock_fill" size={26} className="text-primary" />}
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground text-center">
            {done ? 'Password Updated' : 'New Password'}
          </h1>
          <p role={done ? 'status' : undefined} className="mt-2 text-[15px] text-muted-foreground text-center">
            {done ? 'Redirecting you to sign in…' : 'Choose a new password for your account.'}
          </p>

          {!done && !resetToken && (
            <div className="mt-8 w-full rounded-3xl ember-card px-4 py-4">
              <p role="alert" className="text-[15px] text-destructive text-center">This reset link is invalid or missing its token.</p>
            </div>
          )}

          {!done && resetToken && (
            <form onSubmit={handleSubmit} className="mt-8 w-full flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <input
                  type="password"
                  required
                  aria-label="New password"
                  autoComplete="new-password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ember-input"
                />
                <input
                  type="password"
                  required
                  aria-label="Confirm new password"
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="ember-input"
                />
              </div>
              {error && <p role="alert" className="text-[13px] text-destructive px-1">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full ember-primary text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-40"
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}