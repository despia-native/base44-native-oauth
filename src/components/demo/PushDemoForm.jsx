import { useState } from 'react'
import F7Icon from '@/components/F7Icon'
import { useAuth } from '@/lib/AuthContext'
import { sendPushToSelf, linkPushUser } from '@/lib/push'
import PushDemoAdvanced from '@/components/demo/PushDemoAdvanced'

const DEFAULTS = {
  title: 'Test push 🔔',
  message: 'Hello from the push demo!',
  path: '',
  url: '',
  metadata: '',
  sendAfter: '',
  deliveryTimeOfDay: '',
  badgeType: 'None',
  badgeCount: 1,
}

// Full-option composer — every setting the sendPush backend supports,
// always targeted at the current user (self), so no admin role is needed.
export default function PushDemoForm() {
  const { user } = useAuth()
  const [v, setV] = useState(DEFAULTS)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const set = (key) => (val) => setV((s) => ({ ...s, [key]: val }))

  const handleSend = async () => {
    setResult(null)
    // Metadata must be valid JSON if provided (user-input boundary).
    let metadata
    if (v.metadata.trim()) {
      try { metadata = JSON.parse(v.metadata) } catch {
        setResult({ ok: false, text: 'Metadata is not valid JSON.' })
        return
      }
    }
    setSending(true)
    linkPushUser(user?.id) // re-link device → account right before the test
    try {
      const data = await sendPushToSelf({
        title: v.title,
        message: v.message,
        path: v.path.trim() || undefined,
        url: v.url.trim() || undefined,
        metadata,
        sendAfter: v.sendAfter ? new Date(v.sendAfter).toISOString() : undefined,
        deliveryTimeOfDay: v.deliveryTimeOfDay.trim() || undefined,
        badge: v.badgeType !== 'None' ? { type: v.badgeType, count: Number(v.badgeCount) || 1 } : undefined,
      })
      setResult({
        ok: true,
        text: v.sendAfter || v.deliveryTimeOfDay
          ? 'Scheduled! It will arrive at the chosen time.'
          : `Sent to ${data.recipients} device${data.recipients === 1 ? '' : 's'} — it should arrive within seconds.`,
      })
    } catch (err) {
      setResult({ ok: false, text: err?.response?.data?.error || err?.message || 'Failed to send' })
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="text" placeholder="Title" value={v.title} onChange={(e) => set('title')(e.target.value)} className="ember-input" />
      <textarea
        placeholder="Message"
        value={v.message}
        onChange={(e) => set('message')(e.target.value)}
        rows={3}
        className="ember-input !h-auto !rounded-3xl py-4 resize-none"
      />

      <PushDemoAdvanced values={v} set={set} />

      {result && (
        <p role="alert" className={`text-[13px] px-1 ${result.ok ? 'text-secondary' : 'text-destructive'}`}>{result.text}</p>
      )}

      <button
        type="button"
        disabled={sending || !v.title.trim() || !v.message.trim()}
        onClick={handleSend}
        className="w-full h-14 flex items-center justify-center gap-2 rounded-full ember-accent text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-40"
      >
        {sending ? <span className="ember-spinner" /> : <F7Icon name="bell_fill" size={19} />}
        Send myself this push
      </button>

      <p className="text-[12px] text-muted-foreground px-1 leading-relaxed">
        Your user id: <span className="font-mono">{user?.id}</span>
      </p>
    </div>
  )
}