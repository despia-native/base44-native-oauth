import { useNavigate } from 'react-router-dom'
import { Users, UserCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import ListRow from '@/components/mobile/ListRow'
import PoweredByDespia from '@/components/PoweredByDespia'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const firstName = user?.full_name?.split(' ')[0]
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="relative flex flex-col h-full bg-background">
      <div className="scroll-container px-5" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 72px)' }}>
        {/* Large title */}
        <div className="pt-4 pb-8">
          <h2 className="text-[32px] leading-tight font-bold tracking-tight text-foreground">
            Hello{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">{today}</p>
        </div>

        {/* Grouped list */}
        <div className="rounded-3xl ember-card overflow-hidden">
          <ListRow
            icon={UserCircle}
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
        <PoweredByDespia className="mt-6" />
        <div className="h-32" />
      </div>
    </div>
  )
}