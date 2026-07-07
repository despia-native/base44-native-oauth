import { useState } from 'react'
import { Trash2, ShieldAlert } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import * as customAuth from '@/lib/customAuth'
import { confirmWithLockedVault } from '@/lib/biometricConfirm'
import { isNative } from '@/lib/deviceAuth'
import { haptics } from '@/lib/haptics'
import DeleteConfirmStep from '@/components/account/DeleteConfirmStep'

// Two-step account deletion (see ACCOUNT_DELETION.md):
// 1. Warning drawer — the user explicitly confirms they want to delete.
// 2. Explicit confirmation using the CURRENT authenticated session:
//    native → biometrics (locked Storage Vault read) · web → type DELETE ACCOUNT.
export default function DeleteAccountDrawer({ open, onOpenChange, account, onDeleted }) {
  const native = isNative()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const close = (o) => {
    onOpenChange(o)
    // Reset AFTER the exit animation — swapping content mid-close changes the
    // sheet's height while it slides out and makes the animation cut off.
    if (!o) setTimeout(() => { setStep(1); setError(''); setBusy(false) }, 500)
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
      setError('Biometric confirmation failed — please try again.')
      setBusy(false)
      return
    }
    await doDelete()
  }

  const handleTypeConfirm = async () => {
    setError('')
    setBusy(true)
    await doDelete()
  }

  const step2Text = native
    ? 'Verify it\u2019s you to permanently delete this account.'
    : 'Type DELETE ACCOUNT below to permanently delete this account.'

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
              ? native
                ? 'Your account and all personal data will be permanently deleted. This cannot be undone. Purchases made on this device stay with the device.'
                : 'Your account and all its data will be permanently deleted. This cannot be undone.'
              : step2Text}
          </p>

          {error && <p role="alert" className="text-[13px] text-destructive text-center">{error}</p>}

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
              <DeleteConfirmStep
                native={native}
                busy={busy}
                onBiometric={handleBiometric}
                onTypeConfirm={handleTypeConfirm}
              />
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