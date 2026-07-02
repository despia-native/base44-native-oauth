import { useNavigate } from 'react-router-dom'
import { Users, LogOut, ShieldCheck, Mail } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import ListRow from '@/components/mobile/ListRow'

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex flex-col h-full bg-muted/40">
      {/* Fixed top bar */}
      <header className="shrink-0 pt-safe-top bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="h-11 flex items-center justify-center">
          <h1 className="text-[17px] font-semibold text-foreground">Account</h1>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="scroll-container px-4 pb-safe-bottom">
        {/* Profile header */}
        <div className="flex flex-col items-center text-center pt-8 pb-6">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="w-20 h-20 rounded-full object-cover ring-1 ring-black/5 shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-b from-muted to-secondary flex items-center justify-center text-foreground/80 text-2xl font-semibold ring-1 ring-black/5 shadow-sm">
              {user?.full_name?.[0] || user?.email?.[0] || '?'}
            </div>
          )}
          <h2 className="mt-4 text-[22px] font-semibold tracking-tight text-foreground">
            {user?.full_name || 'Welcome'}
          </h2>
          {isAdmin && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              <ShieldCheck className="w-3 h-3" /> Administrator
            </span>
          )}
        </div>

        {/* Info group */}
        <div className="rounded-2xl bg-card border border-border/60 overflow-hidden shadow-sm">
          <ListRow
            icon={Mail}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Email"
            value={user?.email}
            showChevron={false}
            first
          />
        </div>

        {/* Admin group */}
        {isAdmin && (
          <>
            <p className="px-4 pt-6 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin
            </p>
            <div className="rounded-2xl bg-card border border-border/60 overflow-hidden shadow-sm">
              <ListRow
                icon={Users}
                iconBg="bg-secondary/15"
                iconColor="text-secondary"
                label="Manage users"
                onClick={() => navigate('/admin/users')}
                first
              />
            </div>
          </>
        )}

        {/* Sign out */}
        <div className="mt-6 rounded-2xl bg-card border border-border/60 overflow-hidden shadow-sm">
          <ListRow
            icon={LogOut}
            iconBg="bg-destructive/10"
            label="Sign out"
            danger
            showChevron={false}
            onClick={() => logout()}
            first
          />
        </div>
      </div>
    </div>
  )
}