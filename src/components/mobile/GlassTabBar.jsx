import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { haptics } from '@/lib/haptics'
import F7Icon from '@/components/F7Icon'
import { TABS } from '@/config/navigation'

// Menu items come from src/config/navigation.js — edit TABS there to change the menu.
const tabs = TABS.map(({ path, title, icon }) => ({ path, label: title, icon }))

// iOS 26-style floating liquid-glass tab bar capsule with a gliding
// selection pill (kit .tabbar): the hi-glass thumb translates + resizes
// between tabs on a compositor-friendly transform/width transition.
export default function GlassTabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const btnRefs = useRef({})
  const [thumb, setThumb] = useState(null) // { x, w }

  const activeIndex = tabs.findIndex((t) => t.path === pathname)

  // Measure once per route change; on resize/rotation re-measure at most once
  // per frame via rAF (debounces the burst of resize events WebViews emit).
  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current[pathname]
      if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth })
    }
    measure()
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf) }
  }, [pathname])

  return (
    <nav aria-label="Main menu" className="absolute bottom-0 inset-x-0 z-30 pb-safe-bottom flex justify-center pointer-events-none">
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
        {tabs.map(({ path, label, icon }) => {
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
              <F7Icon name={icon} size={18} className={active ? 'ember-tab-pop' : ''} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}