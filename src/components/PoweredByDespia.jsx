// "Powered by Despia Native" attribution badge.
// Moving to production? Flip SHOW_POWERED_BY to false and it disappears everywhere.
const SHOW_POWERED_BY = true

export default function PoweredByDespia({ className = '' }) {
  if (!SHOW_POWERED_BY) return null
  return (
    <a
      href="https://despia.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`block text-center text-[11px] font-semibold text-muted-foreground/60 py-2 active:opacity-60 ${className}`}
    >
      Powered by <span className="text-primary">Despia Native</span>
    </a>
  )
}