import { useEffect, useRef, useState } from 'react'
import F7Icon from '@/components/F7Icon'

// Native-style swipeable onboarding: horizontal scroll-snap slides + page dots.
// The swipe itself is pure CSS scroll-snap (compositor-driven, jank-free);
// JS only tracks the active dot. scroll events fire far more often than
// frames, so the handler is rAF-throttled and only re-renders when the
// active index actually changes (see DOM_OPTIMIZATION.md).
export default function OnboardingCarousel({ slides }) {
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const handleScroll = () => {
    if (rafRef.current) return // already scheduled this frame
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const el = trackRef.current
      if (!el) return
      const idx = Math.round(el.scrollLeft / el.clientWidth)
      setActive((a) => (a === idx ? a : idx)) // no-op render when unchanged
    })
  }

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        role="group"
        aria-roledescription="carousel"
        aria-label="App introduction"
        className="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          touchAction: 'pan-x',
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className="w-full flex-shrink-0 snap-center flex flex-col items-center px-8 text-center"
          >
            <div className="w-24 h-24 rounded-[28px] ember-glass-hi flex items-center justify-center mb-7">
              <F7Icon name={slide.icon} size={44} className="text-primary" />
            </div>
            <h2 className="text-[28px] leading-tight font-bold tracking-tight text-foreground">
              {slide.title}
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground max-w-[280px]">
              {slide.body}
            </p>
          </div>
        ))}
      </div>

      {/* Page dots — decorative; the current slide is announced via the live region below */}
      <div className="flex items-center justify-center gap-2 mt-7" aria-hidden="true">
        {slides.map((_, i) => (
          <div key={i} className={`ember-dot ${i === active ? 'on' : ''}`} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Slide {active + 1} of {slides.length}: {slides[active]?.title}
      </p>
    </div>
  )
}