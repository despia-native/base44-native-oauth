import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { navMotion } from '@/lib/navMotion'

// Native-style scroll restoration. Pages remount on every navigation (they're
// keyed by pathname for the route transitions), so without this every "back"
// lands at the top of the previous page — web behavior, not native.
// Each page's .scroll-container position is recorded while the user scrolls
// (passive listener, no per-frame JS work) and restored when the page is
// re-entered via a back/swipe navigation. Forward pushes start at the top.
const positions = new Map() // pathname -> scrollTop

export default function ScrollMemory() {
  const anchor = useRef(null)
  const { pathname } = useLocation()

  useEffect(() => {
    // Scoped to THIS page's scroll container (two pages coexist mid-transition).
    const sc = anchor.current?.parentElement?.querySelector('.scroll-container')
    if (!sc) return

    if (navMotion.direction === 'back' || navMotion.direction === 'swipe') {
      const saved = positions.get(pathname)
      if (saved) {
        sc.scrollTop = saved
        // Async content can still be loading — the container may not be tall
        // enough yet. Re-apply for a few frames until the position sticks.
        let tries = 0
        const retry = () => {
          if (Math.abs(sc.scrollTop - saved) > 1 && tries++ < 10) {
            sc.scrollTop = saved
            requestAnimationFrame(retry)
          }
        }
        requestAnimationFrame(retry)
      }
    }

    const onScroll = () => positions.set(pathname, sc.scrollTop)
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => sc.removeEventListener('scroll', onScroll)
  }, [pathname])

  return <span ref={anchor} hidden />
}