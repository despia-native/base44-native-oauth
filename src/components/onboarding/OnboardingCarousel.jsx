import { useRef, useState } from 'react'

// Native-style swipeable onboarding: horizontal scroll-snap slides + page dots.
export default function OnboardingCarousel({ slides }) {
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)

  const handleScroll = () => {
    const el = trackRef.current
    if (!el) return
    setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        onScroll={handleScroll}
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
          <div key={i} className="w-full flex-shrink-0 snap-center flex flex-col items-center px-8 text-center">
            <div className="w-24 h-24 rounded-[28px] ember-glass-hi flex items-center justify-center mb-7">
              <slide.icon className="w-11 h-11 text-primary" strokeWidth={1.8} />
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

      {/* Page dots */}
      <div className="flex items-center justify-center gap-2 mt-7" role="tablist" aria-label="Onboarding pages">
        {slides.map((_, i) => (
          <div
            key={i}
            role="tab"
            aria-selected={i === active}
            className={`ember-dot ${i === active ? 'on' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}