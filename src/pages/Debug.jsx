import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Bell, BellOff, Globe } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { isDespia, checkPushPermission, openDeviceSettings, linkPushUser, sendPush } from '@/lib/push'

// User-facing push debug panel (/debug): shows permission status and lets the
// user send themselves a test push to verify the pipeline end-to-end.
export default function Debug() {
  const { user, authChecked } = useAuth()
  const navigate = useNavigate()
  const [permission, setPermission] = useState(null) // true | false | null (web/unknown)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  // Admin-only in production — mirrors the gating on the Account page row.
  useEffect(() => {
    if (authChecked && user?.role !== 'admin') navigate('/')
  }, [authChecked, user, navigate])

  useEffect(() => {
    if (isDespia) checkPushPermission().then(setPermission)
  }, [])

  const handleTestPush = async () => {
    setSending(true)
    setResult(null)
    linkPushUser(user.id) // re-link device → user right before the test
    try {
      await sendPush({
        target: 'self',
        title: 'Test push 🔔',
        message: 'Push notifications are working on this device.',
        path: '/debug',
      })
      setResult({ ok: true, text: 'Sent! It should arrive on this device within a few seconds.' })
    } catch (err) {
      setResult({ ok: false, text: err?.response?.data?.error || err?.message || 'Failed to send' })
    }
    setSending(false)
  }

  const status = !isDespia
    ? { icon: Globe, text: 'Web preview — push only works in the native app', color: 'text-muted-foreground' }
    : permission === false
      ? { icon: BellOff, text: 'Notifications are disabled on this device', color: 'text-destructive' }
      : { icon: Bell, text: permission ? 'Notifications enabled' : 'Checking permission…', color: 'text-secondary' }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="scroll-container flex flex-col px-5 pt-safe-top pb-safe-bottom">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center text-primary text-[17px] active:opacity-60 self-start mt-4 -ml-1"
        >
          <ChevronLeft className="w-6 h-6" /> Back
        </button>

        <div className="w-full max-w-sm md:max-w-md mx-auto flex flex-col pt-4 pb-16">
          <h1 className="text-[26px] font-bold tracking-tight text-foreground mb-6">Push Debug</h1>

          <div className="rounded-3xl ember-card p-4 mb-4 flex items-center gap-3">
            <status.icon className={`w-5 h-5 shrink-0 ${status.color}`} />
            <p className="text-[14px] text-foreground">{status.text}</p>
          </div>

          {isDespia && permission === false && (
            <button
              type="button"
              onClick={openDeviceSettings}
              className="w-full h-14 rounded-full ember-glass ember-press text-[15px] font-semibold text-foreground active:scale-95 transition-transform mb-4"
            >
              Open device settings
            </button>
          )}

          {result && (
            <p className={`text-[13px] px-1 mb-3 ${result.ok ? 'text-secondary' : 'text-destructive'}`}>{result.text}</p>
          )}

          <button
            type="button"
            disabled={sending}
            onClick={handleTestPush}
            className="w-full h-14 flex items-center justify-center gap-2 rounded-full ember-accent text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-40"
          >
            {sending ? <span className="ember-spinner" /> : <Bell className="w-5 h-5" />}
            Send myself a test push
          </button>

          <p className="mt-4 text-[12px] text-muted-foreground px-1 leading-relaxed">
            Your user id: <span className="font-mono">{user?.id}</span>
          </p>
        </div>
      </div>
    </div>
  )
}