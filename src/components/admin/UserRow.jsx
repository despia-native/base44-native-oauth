import { Shield, Trash2, User as UserIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function UserRow({ account, isSelf, onToggleRole, onDelete, busy }) {
  const isAdmin = account.role === 'admin'
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border last:border-0">
      {account.avatar_url ? (
        <img src={account.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium shrink-0">
          {account.full_name?.[0] || account.email?.[0] || '?'}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{account.full_name || '—'}</span>
          {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{account.email}</p>
      </div>

      <Badge variant={isAdmin ? 'default' : 'secondary'} className="gap-1 shrink-0">
        {isAdmin ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
        {account.role}
      </Badge>

      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => onToggleRole(account)}
        className="shrink-0"
      >
        {isAdmin ? 'Make user' : 'Make admin'}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        disabled={busy || isSelf}
        onClick={() => onDelete(account)}
        className="shrink-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}