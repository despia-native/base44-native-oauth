import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import F7Icon from '@/components/F7Icon'
import { useAuth } from '@/lib/AuthContext'
import * as customAuth from '@/lib/customAuth'
import { haptics } from '@/lib/haptics'

// Email sign-in / register — its own route (/login/email) so it pushes in
// and swipes back like a native page.
export default function EmailLogin() {
  const navigate = useNavigate()
  const { checkUserAuth } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      await checkUserAuth()
      navigate('/', { replace: true })
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Something went wrong'
      haptics.error()
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="scroll-container flex flex-col px-5 pt-safe-top pb-safe-bottom">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center text-primary text-[17px] active:opacity-60 self-start mt-4 -ml-1"
        >
          <F7Icon name="chevron_left" size={22} /> Back
        </button>

        <div className="w-full max-w-sm md:max-w-md mx-auto flex flex-col items-center pt-8 pb-10">
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
                  aria-label="Full name"
                  autoComplete="name"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="ember-input"
                />
              )}
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
              <input
                type="password"
                required
                aria-label="Password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ember-input"
              />
            </div>

            {error && <p role="alert" className="text-[13px] text-destructive px-1">{error}</p>}

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