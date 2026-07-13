import { useState } from 'react'
import F7Icon from '@/components/F7Icon'

// Step 2 of account deletion — the session is already authenticated, so we only
// need an explicit confirmation: biometrics on native (locked vault read),
// typing DELETE ACCOUNT on web.
export default function DeleteConfirmStep({ native, busy, onBiometric, onTypeConfirm }) {
  const [confirmText, setConfirmText] = useState('')
  const dangerBtn = 'w-full h-14 flex items-center justify-center gap-2.5 rounded-full ember-danger text-[16px] font-bold disabled:opacity-40'

  if (native) {
    return (
      <button type="button" disabled={busy} onClick={onBiometric} className={dangerBtn}>
        {busy ? <><span className="ember-spinner" aria-hidden="true" /><span className="sr-only">Deleting account…</span></> : <><F7Icon name="lock_shield_fill" size={19} /> Confirm with biometrics</>}
      </button>
    )
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onTypeConfirm() }} className="flex flex-col gap-3">
      <input
        type="text"
        required
        autoComplete="off"
        aria-label="Type DELETE ACCOUNT to confirm"
        placeholder="Type DELETE ACCOUNT to confirm"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="ember-input"
      />
      <button type="submit" disabled={busy || confirmText.trim().toUpperCase() !== 'DELETE ACCOUNT'} className={dangerBtn}>
        {busy ? <><span className="ember-spinner" aria-hidden="true" /><span className="sr-only">Deleting account…</span></> : 'Permanently delete'}
      </button>
    </form>
  )
}