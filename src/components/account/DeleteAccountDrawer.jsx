import { useState } from 'react'
import { Trash2, Fingerprint, ShieldAlert } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import * as customAuth from '@/lib/customAuth'
import { confirmWithLockedVault } from '@/lib/biometricConfirm'
import { isNative } from '@/lib/deviceAuth'
import { haptics } from '@/lib/haptics'

// Two-step account deletion:
// 1. Warning drawer — the user explicitly confirms they want to delete.
// 2. Confirmation drawer — verify identity with biometrics (locked Storage
//    Vault read = Face ID / Touch ID) on native, or password as fallback.
export default function DeleteAccountDrawer({ open, onOpenChange, account, onDeleted }) {
  const native = isNative()
  // Password fallback only makes sense on native (as a biometric backup) —
  // on the web, accounts may be Google/Apple-only, so type-to-confirm is the default.
  const hasPassword = native && !account?.is_anonymous
  const [step, setStep] = useState(1)
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const close = (o) => {
    onOpenChange(o)
    if (!o) { setStep(1); setPassword(''); setConfirmText(''); setError(''); setBusy(false) }
  }

  const doDelete = async () => {
    try {
      await customAuth.deleteAccount()
      haptics.success?.()
      onDeleted()
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Deletion failed — please try again.')
      setBusy(false)
    }
  }

  const handleBiometric = async () => {
    setError('')
    setBusy(true)
    haptics.heavy?.()
    const ok = await confirmWithLockedVault()
    if (!ok) {
      haptics.error?.()
      setError(hasPassword ? 'Biometric confirmation failed — try again or use your password.' : 'Biometric confirmation failed — please try again.')
      setBusy(false)
      return
    }
    await doDelete()
  }

  const handlePassword = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await customAuth.verifyPassword(account.email, password)
    } catch {
      haptics.error?.()
      setError('Incorrect password')
      setBusy(false)
      return
    }
    await doDelete()
  }

  const handleTypeConfirm = async (e) => {
    e.preventDefault()
    if (confirmText.trim().toUpperCase() !== 'DELETE') return
    setError('')
    setBusy(true)
    await doDelete()
  }

  return (
    <Drawer open={open} onOpenChange={close}>
      <DrawerContent>
        <DrawerHeader className="pb-1 pt-3">
          <DrawerTitle className="text-[17px] font-semibold text-center">
            {step === 1 ? 'Delete account?' : 'Confirm deletion'}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-5 pt-2 flex flex-col gap-3" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 20px)' }}>
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center self-center">
            {step === 1 ? <Trash2 className="w-7 h-7 text-destructive" /> : <ShieldAlert className="w-7 h-7 text-destructive" />}
          </div>
          <p className="text-[14px] text-muted-foreground text-center leading-snug px-2">
            {step === 1
              ? 'Your account and all its data will be permanently deleted. This cannot be undone.'
              : native
                ? 'Verify it\u2019s you to permanently delete this account.'
                : 'Type DELETE below to permanently delete this account.'}
          </p>

          {error && <p className="text-[13px] text-destructive text-center">{error}</p>}

          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={() => { haptics.heavy?.(); setStep(2) }}
                className="w-full h-14 rounded-full ember-danger text-[16px] font-bold"
              >
                Delete my account
              </button>
              <button
                type="button"
                onClick={() => close(false)}
                className="w-full h-14 rounded-full ember-glass ember-press text-[16px] font-semibold text-foreground"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {native && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleBiometric}
                  className="w-full h-14 flex items-center justify-center gap-2.5 rounded-full ember-danger text-[16px] font-bold disabled:opacity-40"
                >
                  {busy ? <span className="ember-spinner" /> : <><Fingerprint className="w-5 h-5" /> Confirm with biometrics</>}
                </button>
              )}
              {hasPassword && (
                <form onSubmit={handlePassword} className="flex flex-col gap-3">
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="ember-input"
                  />
                  <button
                    type="submit"
                    disabled={busy || !password}
                    className="w-full h-14 rounded-full text-[16px] font-semibold ember-glass ember-press text-foreground disabled:opacity-40"
                  >
                    Confirm with password
                  </button>
                </form>
              )}
              {!native && (
                <form onSubmit={handleTypeConfirm} className="flex flex-col gap-3">
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="Type DELETE to confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="ember-input"
                  />
                  <button
                    type="submit"
                    disabled={busy || confirmText.trim().toUpperCase() !== 'DELETE'}
                    className="w-full h-14 rounded-full ember-danger text-[16px] font-bold disabled:opacity-40"
                  >
                    {busy ? <span className="ember-spinner inline-block align-middle" /> : 'Permanently delete'}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => close(false)}
                className="w-full h-12 rounded-full text-[15px] font-semibold text-muted-foreground"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}