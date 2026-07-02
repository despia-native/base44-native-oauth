import { useNavigate } from 'react-router-dom'
import { Users, ChevronRight, Sparkles, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import GlassHeader from '@/components/mobile/GlassHeader'
import GlassTabBar from '@/components/mobile/GlassTabBar'
import AmbientBackground from '@/components/mobile/AmbientBackground'
import ListRow from '@/components/mobile/ListRow'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const firstName = user?.full_name?.split(' ')[0]
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="relative flex flex-col h-full bg-muted/40 overflow-hidden">
      <AmbientBackground />
      <GlassHeader
        title="Home"
        right={
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="w-8 h-8 rounded-full overflow-hidden active:scale-95 transition-transform"
            aria-label="Account"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-primary/15 text-primary text-[13px] font-semibold">
                {firstName?.[0] || user?.email?.[0] || '?'}
              </span>
            )}
          </button>
        }
      />

      <div className="scroll-container relative px-5" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 72px)' }}>
        {/* Large title greeting */}
        <div className="pt-4 pb-6">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-primary">{today}</p>
          <h2 className="mt-1 text-[32px] leading-tight font-bold tracking-tight text-foreground">
            Hello{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">Welcome back to your app.</p>
        </div>

        {/* Hero glass card */}
        <div className="rounded-3xl glass-card p-5 mb-6">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-1 text-[11px] font-semibold text-secondary">
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
          </div>
          <h3 className="mt-4 text-[19px] font-semibold tracking-tight text-foreground">Your session is active</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            You're signed in as {user?.email}. Manage your profile and settings from the Account tab.
          </p>
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-4 py-2 text-[14px] font-semibold active:opacity-80 active:scale-[0.97] transition-all shadow-sm"
          >
            View Account <ChevronRight className="w-4 h-4 -mr-1" />
          </button>
        </div>

        {/* Quick actions */}
        <p className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick actions
        </p>
        <div className="rounded-2xl glass-card overflow-hidden mb-32">
          <ListRow
            icon={Sparkles}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Account"
            onClick={() => navigate('/account')}
            first
          />
          {isAdmin && (
            <ListRow
              icon={Users}
              iconBg="bg-secondary/15"
              iconColor="text-secondary"
              label="Manage users"
              onClick={() => navigate('/admin/users')}
            />
          )}
        </div>
      </div>

      <GlassTabBar />
    </div>
  )
}