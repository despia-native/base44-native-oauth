import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, UserCircle } from 'lucide-react'
import { haptics } from '@/lib/haptics'

const tabs = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/account', label: 'Account', icon: UserCircle },
]

// iOS 26-style floating liquid-glass tab bar capsule with a gliding
// selection pill (kit .tabbar): the hi-glass thumb translates + resizes
// between tabs on a compositor-friendly transform/width transition.
export default function GlassTabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const btnRefs = useRef({})
  const [thumb, setThumb] = useState(null) // { x, w }

  const activeIndex = tabs.findIndex((t) => t.path === pathname)

  useLayoutEffect(() => {
    const el = btnRefs.current[pathname]
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth })
  }, [pathname])

  return (
    <nav className="absolute bottom-0 inset-x-0 z-30 pb-safe-bottom flex justify-center pointer-events-none">
      <div className="relative mb-3 rounded-full liquid-glass flex items-center gap-1 p-1.5 pointer-events-auto">
        {/* Gliding selection pill — no overshoot so it never flies past edge tabs */}
        {thumb && activeIndex !== -1 && (
          <div
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 left-0 rounded-full ember-glass-hi"
            style={{
              width: thumb.w,
              transform: `translateX(${thumb.x}px)`,
              willChange: 'transform',
              transition: 'transform .32s cubic-bezier(.2,.9,.3,1), width .32s cubic-bezier(.2,.9,.3,1)',
            }}
          />
        )}
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = pathname === path
          return (
            <button
              key={path}
              type="button"
              ref={(el) => { btnRefs.current[path] = el }}
              onClick={() => { if (!active) { haptics.light?.(); navigate(path) } }}
              aria-current={active ? 'page' : undefined}
              className={`relative z-[1] flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold transition-[color,transform] duration-300 [transition-timing-function:var(--spring)] active:scale-[.92] ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] ${active ? 'ember-tab-pop' : ''}`} strokeWidth={2.2} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}