// iOS-style edge swipe-back gesture. Wraps a page; a drag starting at the left
// screen edge tracks the finger, and releasing past the threshold (or a quick
// flick) navigates back — soft SPA navigation, no reload.
//
// PERF (see DOM_OPTIMIZATION.md): touchmove can fire faster than the display
// refresh rate (120Hz devices, or coalesced events in WKWebView). Writing
// styles on every event forces redundant style recalcs and stutters in Low
// Power Mode. All DOM writes are therefore batched through a single
// requestAnimationFrame — max one write per rendered frame — and use
// translate3d so WKWebView / Android WebView keep the page on a GPU layer.
// will-change is applied only WHILE the gesture is live, never permanently.
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { navMotion } from '@/lib/navMotion'

const EDGE = 28 // gesture must start within this many px of the left edge

// There must be somewhere to go back TO. On a deep-linked / notification /
// cold-start entry the page is the first history entry — committing the swipe
// would slide the page off-screen while navigate(-1) does nothing, leaving a
// blank screen (react-router keeps its history index in history.state.idx).
const canGoBack = () => (window.history.state?.idx ?? 0) > 0

export default function SwipeBack({ enabled = true, children }) {
  const navigate = useNavigate()
  const ref = useRef(null)
  const gesture = useRef(null)
  const rafId = useRef(0)
  const pendingDx = useRef(0)

  useEffect(() => () => cancelAnimationFrame(rafId.current), [])

  // One DOM write per frame, no matter how many touchmove events arrived.
  const scheduleWrite = () => {
    if (rafId.current) return
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0
      const el = ref.current
      if (el && gesture.current?.active) {
        el.style.transform = `translate3d(${pendingDx.current}px,0,0)`
      }
    })
  }

  const onTouchStart = (e) => {
    if (!enabled || !canGoBack()) return
    const t = e.touches[0]
    if (t.clientX > EDGE) return
    gesture.current = { x: t.clientX, y: t.clientY, start: Date.now(), active: false }
  }

  const onTouchMove = (e) => {
    const g = gesture.current
    if (!g) return
    const t = e.touches[0]
    const dx = t.clientX - g.x
    const dy = t.clientY - g.y
    if (!g.active) {
      if (Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return } // vertical scroll wins
      if (dx < 8) return
      g.active = true
      const el = ref.current
      if (el) {
        el.style.transition = 'none'
        el.style.willChange = 'transform' // promote to a layer only for the gesture
      }
    }
    pendingDx.current = Math.max(0, dx)
    scheduleWrite()
  }

  const endGesture = (el) => {
    // Drop the layer promotion once the finish/cancel transition completes.
    setTimeout(() => { if (el) { el.style.willChange = ''; el.style.transition = '' } }, 280)
  }

  const onTouchEnd = (e) => {
    const g = gesture.current
    gesture.current = null
    if (!g?.active) return
    cancelAnimationFrame(rafId.current)
    rafId.current = 0
    const dx = e.changedTouches[0].clientX - g.x
    const velocity = dx / Math.max(1, Date.now() - g.start) // px per ms
    const el = ref.current
    if (dx > window.innerWidth * 0.33 || velocity > 0.5) {
      // Commit: finish the slide off-screen (CSS transition, GPU), then go back.
      if (el) {
        el.style.transition = 'transform .18s ease-out'
        el.style.transform = `translate3d(${window.innerWidth}px,0,0)`
      }
      // Tell the router the exit was already animated by the finger — it will
      // swap pages instantly instead of replaying a second slide (flash fix).
      setTimeout(() => { navMotion.swipeBack = true; navigate(-1) }, 170)
      endGesture(el)
    } else if (el) {
      // Cancel: spring back into place.
      el.style.transition = 'transform .25s cubic-bezier(.3,1.1,.4,1)'
      el.style.transform = 'translate3d(0,0,0)'
      endGesture(el)
    }
  }

  // System interruption (incoming call, OS gesture) cancels the touch — spring
  // the page back instead of leaving it stuck half-dragged off-screen.
  const onTouchCancel = () => {
    const g = gesture.current
    gesture.current = null
    if (!g?.active) return
    cancelAnimationFrame(rafId.current)
    rafId.current = 0
    const el = ref.current
    if (el) {
      el.style.transition = 'transform .25s cubic-bezier(.3,1.1,.4,1)'
      el.style.transform = 'translate3d(0,0,0)'
      endGesture(el)
    }
  }

  return (
    <div
      ref={ref}
      className="flex-1 min-h-0 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {children}
    </div>
  )
}