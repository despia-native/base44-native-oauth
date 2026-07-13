import F7Icon from '@/components/F7Icon'

// One saved account on the login screen's picker — tap to continue, × to forget.
export default function SavedAccountRow({ account, first, onSelect, onRemove }) {
  const name = account.is_anonymous ? 'Guest account' : (account.full_name || account.email)
  return (
    <div className={`flex items-center gap-1 pr-2 ${first ? '' : 'border-t border-border/60'}`}>
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-3 flex-1 min-w-0 text-left pl-4 py-3 active:opacity-60"
      >
        {account.avatar_url ? (
          <img src={account.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-foreground/70 font-semibold">
            {account.is_anonymous ? <F7Icon name="person_fill" size={19} /> : (name?.[0] || '?').toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground truncate">Continue as {name}</p>
          {!account.is_anonymous && account.full_name && (
            <p className="text-[12px] text-muted-foreground truncate">{account.email}</p>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove account from this device"
        className="p-2.5 text-muted-foreground/50 active:opacity-60 shrink-0"
      >
        <F7Icon name="xmark" size={15} />
      </button>
    </div>
  )
}