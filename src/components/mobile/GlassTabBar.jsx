import { useLocation, useNavigate } from 'react-router-dom'
import { Home, UserCircle } from 'lucide-react'
import { haptics } from '@/lib/haptics'

const tabs = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/account', label: 'Account', icon: UserCircle },
]

// iOS 26-style floating liquid-glass tab bar capsule.
export default function GlassTabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="absolute bottom-0 inset-x-0 z-30 pb-safe-bottom flex justify-center pointer-events-none">
      <div className="mb-3 rounded-full liquid-glass flex items-center gap-1 p-1.5 pointer-events-auto">
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = pathname === path
          return (
            <button
              key={path}
              type="button"
              onClick={() => { if (!active) { haptics.light?.(); navigate(path) } }}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all active:scale-95 ${
                active
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}