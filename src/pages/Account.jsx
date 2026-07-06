import { useNavigate } from 'react-router-dom'
import { Users, LogOut, ShieldCheck, Mail, BadgeCheck, UserPlus, ChevronRight, Bell, Bug } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import ListRow from '@/components/mobile/ListRow'
import PremiumSection from '@/components/premium/PremiumSection'
import PoweredByDespia from '@/components/PoweredByDespia'

export default function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="relative flex flex-col h-full bg-background">
      <div className="scroll-container px-5" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 72px)' }}>
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
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-foreground/70 text-3xl font-semibold ring-1 ring-black/5 shadow-sm">
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
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {user?.is_anonymous ? 'Guest account' : user?.email}
          </p>
          {isAdmin && (
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-secondary/15 px-3 py-1 text-[12px] font-semibold text-secondary">
              <ShieldCheck className="w-3.5 h-3.5" /> Administrator
            </span>
          )}
        </div>

        {/* Guest upgrade — link a real login while keeping all data */}
        {user?.is_anonymous && (
          <button
            type="button"
            onClick={() => navigate('/link-account')}
            className="w-full text-left rounded-3xl ember-card p-4 mb-6 flex items-center gap-3.5 active:bg-muted/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-foreground">Protect your account</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug">
                Add an email or Google login so your data is safe and you can sign in anywhere.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
          </button>
        )}

        {/* Info group */}
        {!user?.is_anonymous && (
          <>
            <p className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              Details
            </p>
            <div className="rounded-3xl ember-card overflow-hidden">
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
          </>
        )}

        {/* Premium / subscription */}
        <PremiumSection />

        {/* Admin group */}
        {isAdmin && (
          <>
            <p className="px-1 pt-6 pb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            <div className="rounded-3xl ember-card overflow-hidden">
              <ListRow
                icon={Users}
                iconBg="bg-secondary/15"
                iconColor="text-secondary"
                label="Manage users"
                onClick={() => navigate('/admin/users')}
                first
              />
              <ListRow
                icon={Bell}
                iconBg="bg-primary/10"
                iconColor="text-primary"
                label="Push notifications"
                onClick={() => navigate('/admin/push')}
              />
            </div>
          </>
        )}

        {/* Developer tools — admin only in production */}
        {isAdmin && (
          <div className="mt-6 rounded-3xl ember-card overflow-hidden">
            <ListRow
              icon={Bug}
              iconBg="bg-muted"
              label="Push debug"
              onClick={() => navigate('/debug')}
              first
            />
          </div>
        )}

        {/* Sign out — only for REAL accounts. A guest (anonymous device account
            never linked to email/Google/Apple) IS the logged-out state; signing
            it out is meaningless and would just recreate the same session. */}
        {!user?.is_anonymous && (
          <div className="mt-6 rounded-3xl ember-card overflow-hidden">
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
        )}
        <PoweredByDespia className="mt-6" />
        <div className="h-32" />
      </div>
    </div>
  )
}