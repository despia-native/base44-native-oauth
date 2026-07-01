import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Check both query params (native deeplink) and hash (web OAuth redirect)
    const hash            = new URLSearchParams(window.location.hash.substring(1))
    const googleToken     = searchParams.get('access_token') || hash.get('access_token')
    const base44Token     = searchParams.get('token')        || hash.get('token')
    const error           = searchParams.get('error')        || hash.get('error')

    if (error) {
      console.error('Auth error:', error)
      navigate('/login')
      return
    }

    if (base44Token) {
      // Web flow: Base44 issues its own token directly (via loginWithProvider redirect)
      base44.auth.setToken(base44Token)
      window.location.href = '/'
      return
    }

    if (googleToken) {
      // Native flow: send Google token to our backend for verification + Base44 token issuance
      // Backend verifies with Google API → finds/creates user by email → issues Base44 JWT
      base44.functions.invoke('googleSignIn', { google_token: googleToken })
        .then((res) => {
          const { access_token } = res.data
          base44.auth.setToken(access_token)
          window.location.href = '/'
        })
        .catch((err) => {
          console.error('Google sign-in exchange failed:', err)
          navigate('/login')
        })
    }
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}