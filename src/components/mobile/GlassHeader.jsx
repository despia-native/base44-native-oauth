// iOS 26-style floating glass navigation bar.
// Renders as an inset capsule under the safe area instead of a full-width bar.
export default function GlassHeader({ title, left, right }) {
  return (
    <header className="absolute top-0 inset-x-0 z-30 pt-safe-top px-3 pointer-events-none">
      <div className="mt-2 h-12 rounded-full liquid-glass grid grid-cols-[1fr_auto_1fr] items-center px-2 pointer-events-auto">
        <div className="justify-self-start flex items-center">{left}</div>
        <h1 className="text-[17px] font-semibold text-foreground tracking-tight">{title}</h1>
        <div className="justify-self-end flex items-center">{right}</div>
      </div>
    </header>
  )
}