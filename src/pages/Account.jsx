import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import F7Icon from '@/components/F7Icon'
import { useAuth } from '@/lib/AuthContext'
import { removeSavedAccount } from '@/lib/savedAccounts'
import DeleteAccountDrawer from '@/components/account/DeleteAccountDrawer'
import ListRow from '@/components/mobile/ListRow'
import PremiumSection from '@/components/premium/PremiumSection'
import PoweredByDespia from '@/components/PoweredByDespia'

export default function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Account is gone server-side — drop it from the device switcher and sign out.
  const handleDeleted = () => {
    if (user?.id) removeSavedAccount(user.id)
    logout()
  }

  return (
    <div className="relative flex flex-col h-full bg-background">
      <div className="scroll-container px-5" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 72px)' }}>
        <div className="page-wrap">
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
                <F7Icon name="checkmark_seal_fill" size={18} className="text-primary" />
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
              <F7Icon name="checkmark_shield_fill" size={13} /> Administrator
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
              <F7Icon name="person_badge_plus_fill" size={19} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-foreground">Protect your account</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug">
                Add an email or Google login so your data is safe and you can sign in anywhere.
              </p>
            </div>
            <F7Icon name="chevron_right" size={16} className="text-muted-foreground/50" />
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
                icon="envelope_fill"
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

        {/* Push demo — test notifications with every option, on this device */}
        <p className="px-1 pt-6 pb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          Testing
        </p>
        <div className="rounded-3xl ember-card overflow-hidden">
          <ListRow
            icon="bell_circle_fill"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Push notification demo"
            onClick={() => navigate('/demo')}
            first
          />
        </div>

        {/* Admin group */}
        {isAdmin && (
          <>
            <p className="px-1 pt-6 pb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            <div className="rounded-3xl ember-card overflow-hidden">
              <ListRow
                icon="person_2_fill"
                iconBg="bg-secondary/15"
                iconColor="text-secondary"
                label="Manage users"
                onClick={() => navigate('/admin/users')}
                first
              />
              <ListRow
                icon="bell_fill"
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
              icon="ant_fill"
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
              icon="square_arrow_right"
              iconBg="bg-destructive/10"
              label="Sign out"
              danger
              showChevron={false}
              onClick={() => logout()}
              first
            />
          </div>
        )}
        {/* Delete account — available to everyone (guests included) */}
        <div className="mt-6 rounded-3xl ember-card overflow-hidden">
          <ListRow
            icon="trash_fill"
            iconBg="bg-destructive/10"
            label="Delete account"
            danger
            showChevron={false}
            onClick={() => setDeleteOpen(true)}
            first
          />
        </div>

        <PoweredByDespia className="mt-6" />
        <div className="h-32" />
        </div>
      </div>

      <DeleteAccountDrawer
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        account={user}
        onDeleted={handleDeleted}
      />
    </div>
  )
}