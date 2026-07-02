import { useNavigate } from 'react-router-dom'
import { Users, LogOut, ShieldCheck, Mail, BadgeCheck } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import GlassHeader from '@/components/mobile/GlassHeader'
import GlassTabBar from '@/components/mobile/GlassTabBar'
import AmbientBackground from '@/components/mobile/AmbientBackground'
import ListRow from '@/components/mobile/ListRow'

export default function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="relative flex flex-col h-full bg-muted/40 overflow-hidden">
      <AmbientBackground />
      <GlassHeader title="Account" />

      <div className="scroll-container relative px-5" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 72px)' }}>
        {/* Profile hero */}
        <div className="flex flex-col items-center text-center pt-6 pb-6">
          <div className="relative">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-24 h-24 rounded-full object-cover ring-4 ring-background shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-b from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-3xl font-semibold ring-4 ring-background shadow-lg">
                {user?.full_name?.[0] || user?.email?.[0] || '?'}
              </div>
            )}
            {user?.email_verified && (
              <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-background flex items-center justify-center shadow-sm">
                <BadgeCheck className="w-5 h-5 text-primary" />
              </span>
            )}
          </div>
          <h2 className="mt-4 text-[24px] font-bold tracking-tight text-foreground">
            {user?.full_name || 'Welcome'}
          </h2>
          <p className="mt-0.5 text-[14px] text-muted-foreground">{user?.email}</p>
          {isAdmin && (
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-secondary/15 px-3 py-1 text-[12px] font-semibold text-secondary">
              <ShieldCheck className="w-3.5 h-3.5" /> Administrator
            </span>
          )}
        </div>

        {/* Info group */}
        <p className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </p>
        <div className="rounded-2xl glass-card overflow-hidden">
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
            <p className="px-1 pt-6 pb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            <div className="rounded-2xl glass-card overflow-hidden">
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
        <div className="mt-6 rounded-2xl glass-card overflow-hidden mb-32">
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

      <GlassTabBar />
    </div>
  )
}