import { Mail, Apple, User } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import GoogleIcon from '@/components/GoogleIcon'
import SavedAccountRow from '@/components/onboarding/SavedAccountRow'

// Native-feel bottom sheet for switching accounts: saved accounts on this
// device first, then the fresh sign-in options.
export default function AccountPickerDrawer({
  open, onOpenChange, savedAccounts,
  onSelectSaved, onRemoveSaved,
  onGoogle, onApple, onEmail, onGuest,
}) {
  const option = 'w-full h-13 min-h-[52px] flex items-center justify-center gap-3 rounded-full ember-glass ember-press active:scale-95 transition-transform text-[15px] font-semibold text-foreground'
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-[17px]">Choose an account</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pt-2 flex flex-col gap-3" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 20px)' }}>
          {savedAccounts.length > 0 && (
            <div className="rounded-3xl ember-card overflow-hidden">
              {savedAccounts.map((a, i) => (
                <SavedAccountRow
                  key={a.id}
                  account={a}
                  first={i === 0}
                  onSelect={() => onSelectSaved(a)}
                  onRemove={() => onRemoveSaved(a.id)}
                />
              ))}
            </div>
          )}

          <p className="px-1 pt-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Or sign in with
          </p>
          <button type="button" onClick={onGoogle} className={option}>
            <GoogleIcon className="w-5 h-5" /> Google
          </button>
          <button type="button" onClick={onApple} className={option}>
            <Apple className="w-5 h-5 fill-current" /> Apple
          </button>
          <button type="button" onClick={onEmail} className={option}>
            <Mail className="w-5 h-5" /> Email
          </button>
          {onGuest && (
            <button type="button" onClick={onGuest} className="w-full h-11 text-[14px] font-medium text-muted-foreground active:opacity-60 flex items-center justify-center gap-2">
              <User className="w-4 h-4" /> Continue as guest
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}