import { useState } from 'react'
import F7Icon from '@/components/F7Icon'
import { sendPush } from '@/lib/push'

// Compose + send a push. target: 'all' or an account object ({id, email, ...}).
export default function PushComposer({ target }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [path, setPath] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null) // { ok, text }

  const handleSend = async () => {
    setSending(true)
    setResult(null)
    try {
      const data = await sendPush({
        target: target === 'all' ? 'all' : 'user',
        userId: target === 'all' ? undefined : target.id,
        title,
        message,
        path: path.trim() || undefined,
      })
      setResult({ ok: true, text: `Sent (${data.recipients} recipient${data.recipients === 1 ? '' : 's'})` })
      setTitle(''); setMessage(''); setPath('')
    } catch (err) {
      setResult({ ok: false, text: err?.response?.data?.error || err?.message || 'Failed to send' })
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="ember-input" />
      <textarea
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="ember-input !h-auto !rounded-3xl py-4 resize-none"
      />
      <input type="text" placeholder="Open path on tap (optional, e.g. /account)" value={path} onChange={(e) => setPath(e.target.value)} className="ember-input" />

      {result && (
        <p className={`text-[13px] px-1 ${result.ok ? 'text-secondary' : 'text-destructive'}`}>{result.text}</p>
      )}

      <button
        type="button"
        disabled={sending || !title.trim() || !message.trim()}
        onClick={handleSend}
        className="w-full h-14 flex items-center justify-center gap-2 rounded-full ember-accent text-[16px] font-bold active:scale-95 transition-transform disabled:opacity-40"
      >
        {sending ? <span className="ember-spinner" /> : <F7Icon name="paperplane_fill" size={17} />}
        {target === 'all' ? 'Send to all users' : `Send to ${target?.full_name || target?.email || 'user'}`}
      </button>
    </div>
  )
}