import { useRef } from 'react'
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import PageNotFound from '@/lib/PageNotFound'
import ProtectedRoute from '@/components/ProtectedRoute'
import GlassHeader from '@/components/mobile/GlassHeader'
import GlassTabBar from '@/components/mobile/GlassTabBar'
import SwipeBack from '@/components/SwipeBack'
import RedirectToLogin from '@/components/RedirectToLogin'
import ScrollMemory from '@/components/ScrollMemory'
import { pages, componentFor } from '@/lib/pageRoutes'
import { navMotion } from '@/lib/navMotion'
import { TABS, PUBLIC_PATHS, ALIASES } from '@/config/navigation'

// Native iOS navigation transitions, direction-aware:
//  • push  — new page slides in from the right ON TOP; old page parallax-drifts
//    to -30% and dims underneath (UINavigationController push).
//  • back  — old page slides off to the right ON TOP; the previous page slides
//    back from -30% underneath (UINavigationController pop).
//  • tab   — switching between tab-bar roots is STATIC (instant swap): the
//    persistent chrome and main navigation never animate.
//  • swipe — the gesture already slid the old page off-screen, so the router
//    swaps instantly: no second animation, no flash.
const pageVariants = {
  initial: (dir) =>
    dir === 'tab' || dir === 'swipe' ? { opacity: dir === 'tab' ? 0 : 1, x: 0, zIndex: 1 }
    : dir === 'back' ? { x: '-30%', opacity: 0.85, zIndex: 0 }
    : { x: '100%', opacity: 1, zIndex: 2 },
  animate: { x: 0, opacity: 1 },
  exit: (dir) =>
    dir === 'tab' ? { opacity: 0, x: 0, zIndex: 0 }
    : dir === 'back' || dir === 'swipe' ? { x: '100%', opacity: 1, zIndex: 2 }
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


  // Direction is computed ONCE per location change and cached in a ref, so
  // re-renders during an in-flight animation can never flip the variants
  // mid-transition (that mid-flight flip was one source of the flashing).
  // An in-app history stack also detects "back" when it happens via a <Link>
  // (e.g. a header Back button) — not just browser/gesture POP — so those
  // play the pop animation instead of a wrong-direction push.
  const navRef = useRef({ path: location.pathname, direction: 'push', stack: [location.pathname] })
  if (navRef.current.path !== location.pathname) {
    const { stack, path: prevPath } = navRef.current
    let direction
    if (navMotion.swipeBack) direction = 'swipe'
    else if (navType === 'POP' || stack[stack.length - 2] === location.pathname) direction = 'back'
    else direction = 'push'
    if (TAB_TITLES[prevPath] && TAB_TITLES[location.pathname]) direction = 'tab'
    navMotion.swipeBack = false
    let stackNext =
      direction === 'tab' ? [location.pathname]
      : direction === 'back' || direction === 'swipe' ? stack.slice(0, -1)
      : [...stack, location.pathname]
    if (stackNext[stackNext.length - 1] !== location.pathname) stackNext = [...stackNext, location.pathname]
    navRef.current = { path: location.pathname, direction, stack: stackNext }
    navMotion.direction = direction // ScrollMemory restores scroll only on back/swipe
  }
  const direction = navRef.current.direction

  // Spring physics for push/back (fluid, native settle); tab roots and
  // post-gesture swaps are instant. Reduce Motion → short fade.
  const transition =
    direction === 'tab' || direction === 'swipe' ? { duration: 0 }
    : reduceMotion ? { duration: 0.15 }
    : { type: 'spring', stiffness: 400, damping: 42, mass: 1 }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
    <AnimatePresence initial={false} custom={direction}>
      {/* Pages are absolutely stacked (not popLayout) — the exiting page keeps
          its exact size and position while both are on screen, which removes
          the layout jump/flash popLayout caused on back navigation. */}
      <motion.div
        key={location.pathname}
        custom={direction}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0 flex flex-col overflow-hidden bg-background"
        // PERF: no permanent willChange — a full-page layer kept alive forever
        // costs GPU memory in WKWebView/Android WebView and causes Low Power
        // Mode jank; framer-motion promotes the layer only while animating.
        // The edge shadow blur is kept small — it rasterizes with the layer.
        style={{ boxShadow: '-0.5rem 0 1.25rem rgba(0,0,0,.16)' }}
        transition={transition}
      >
        {/* Native edge swipe-back on every page EXCEPT the menu-bar roots */}
        <ScrollMemory />
        <SwipeBack enabled={!tabPage}>
          <Routes location={location}>
            {publicPages.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
            {Object.entries(ALIASES).map(([alias, target]) => {
              const Component = componentFor(target)
              return Component ? <Route key={alias} path={alias} element={<Component />} /> : null
            })}
            <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
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