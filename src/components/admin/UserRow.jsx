import F7Icon from '@/components/F7Icon'
import { format, formatDistanceToNow } from 'date-fns'

export default function UserRow({ account, isSelf, onToggleRole, onDelete, busy }) {
  const isAdmin = account.role === 'admin'
  const method = account.is_anonymous ? 'Guest' : account.has_google ? 'Google' : account.has_apple ? 'Apple' : 'Email'
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border/60 last:border-0">
      {account.avatar_url ? (
        <img src={account.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[15px] font-medium shrink-0">
          {account.full_name?.[0] || account.email?.[0] || '?'}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-medium text-foreground truncate">{account.full_name || '—'}</span>
          {account.email_verified && <F7Icon name="checkmark_seal_fill" size={13} className="text-primary" />}
          {isSelf && <span className="text-[11px] text-muted-foreground">(you)</span>}
        </div>
        <p className="text-[13px] text-muted-foreground truncate">{account.email}</p>
        <p className="text-[11px] text-muted-foreground/80 truncate">
          {method}
          {account.created_date && <> · Joined {format(new Date(account.created_date), 'MMM d, yyyy')}</>}
          {account.last_login_at && <> · Seen {formatDistanceToNow(new Date(account.last_login_at), { addSuffix: true })}</>}
        </p>
      </div>

      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${
        isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {isAdmin ? <F7Icon name="shield_fill" size={11} /> : <F7Icon name="person_fill" size={11} />}
        {account.role}
      </span>

      <button
        type="button"
        disabled={busy}
        onClick={() => onToggleRole(account)}
        className="shrink-0 rounded-full border border-border/70 px-3 py-1.5 text-[13px] font-medium text-primary active:bg-muted/60 transition-colors disabled:opacity-50"
      >
        {isAdmin ? 'Make user' : 'Make admin'}
      </button>

      <button
        type="button"
        disabled={busy || isSelf}
        onClick={() => onDelete(account)}
        className="shrink-0 p-2 text-destructive active:opacity-60 disabled:opacity-30"
        aria-label="Delete account"
      >
        <F7Icon name="trash_fill" size={15} />
      </button>
    </div>
  )
}