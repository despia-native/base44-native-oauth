import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import PageNotFound from '@/lib/PageNotFound'
import ProtectedRoute from '@/components/ProtectedRoute'
import GlassHeader from '@/components/mobile/GlassHeader'
import GlassTabBar from '@/components/mobile/GlassTabBar'
import SwipeBack from '@/components/SwipeBack'
import { pages, componentFor } from '@/lib/pageRoutes'
import { TABS, PUBLIC_PATHS, ALIASES } from '@/config/navigation'

// Native iOS navigation transitions, direction-aware:
//  • push  — new page slides in from the right ON TOP; old page parallax-drifts
//    to -30% and dims underneath (UINavigationController push).
//  • back  — old page slides off to the right ON TOP; the previous page slides
//    back from -30% underneath (UINavigationController pop).
//  • tab   — switching between tab-bar roots crossfades (UITabBarController).
const pageVariants = {
  initial: (dir) =>
    dir === 'tab' ? { opacity: 0, x: 0, zIndex: 1 }
    : dir === 'back' ? { x: '-30%', opacity: 0.85, zIndex: 0 }
    : { x: '100%', opacity: 1, zIndex: 2 },
  animate: { x: 0, opacity: 1 },
  exit: (dir) =>
    dir === 'tab' ? { opacity: 0, x: 0, zIndex: 0 }
    : dir === 'back' ? { x: '100%', opacity: 1, zIndex: 2 }
    : { x: '-30%', opacity: 0.85, zIndex: 0 },
}

// Routes are generated from the pages folder (src/lib/pageRoutes.js) and the
// navigation config — adding a page never requires editing this file.
const TAB_TITLES = Object.fromEntries(TABS.map((t) => [t.path, t.title]))
const publicPages = pages.filter((p) => PUBLIC_PATHS.includes(p.path))
const protectedPages = pages.filter((p) => !PUBLIC_PATHS.includes(p.path))

export default function AnimatedRoutes() {
  const location = useLocation()
  const navType = useNavigationType()
  // Reduce Motion (often paired with Low Power Mode) → crossfade instead of slide.
  const reduceMotion = useReducedMotion()
  // Tab pages share persistent chrome rendered OUTSIDE the route animation,
  // so the header and tab bar stay perfectly still while pages swipe under them.
  const tabPage = TAB_TITLES[location.pathname]

  // Direction: browser/gesture back = pop; tab-root ↔ tab-root = fade; else push.
  const prevPathRef = useRef(location.pathname)
  const prevPath = prevPathRef.current
  let direction = navType === 'POP' ? 'back' : 'push'
  if (TAB_TITLES[prevPath] && TAB_TITLES[location.pathname]) direction = 'tab'
  useEffect(() => { prevPathRef.current = location.pathname }, [location.pathname])

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={location.pathname}
        custom={direction}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex-1 min-h-0 flex flex-col bg-background"
        // PERF: no permanent willChange — a full-page layer kept alive forever
        // costs GPU memory in WKWebView/Android WebView and causes Low Power
        // Mode jank; framer-motion promotes the layer only while animating.
        // The edge shadow blur is kept small — it rasterizes with the layer.
        style={{ boxShadow: '-0.5rem 0 1.25rem rgba(0,0,0,.16)' }}
        transition={reduceMotion ? { duration: 0.15 } : { duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Native edge swipe-back on every page EXCEPT the menu-bar roots */}
        <SwipeBack enabled={!tabPage}>
          <Routes location={location}>
            {publicPages.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
            {Object.entries(ALIASES).map(([alias, target]) => {
              const Component = componentFor(target)
              return Component ? <Route key={alias} path={alias} element={<Component />} /> : null
            })}
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              {protectedPages.map(({ path, Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </SwipeBack>
      </motion.div>
    </AnimatePresence>

    {tabPage && <GlassHeader title={tabPage} />}
    {tabPage && <GlassTabBar />}
    </div>
  )
}