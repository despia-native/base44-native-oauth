import { ChevronRight } from 'lucide-react'

// iOS-style grouped list row. Renders as a Link, button, or static div.
export default function ListRow({
  icon: Icon,
  iconBg = 'bg-secondary',
  iconColor = 'text-foreground/70',
  label,
  value,
  onClick,
  showChevron = true,
  danger = false,
  first = false,
}) {
  const content = (
    <>
      {Icon && (
        <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${iconBg}`}>
          <Icon className={`w-4 h-4 ${danger ? 'text-destructive' : iconColor}`} />
        </span>
      )}
      <span className={`flex-1 text-left text-[15px] ${danger ? 'text-destructive font-medium' : 'text-foreground'}`}>
        {label}
      </span>
      {value && <span className="text-[15px] text-muted-foreground">{value}</span>}
      {showChevron && onClick && <ChevronRight className="w-4 h-4 text-muted-foreground/60" />}
    </>
  )

  const base = `flex items-center gap-3 w-full px-4 py-3 active:bg-muted/60 transition-colors ${
    first ? '' : 'border-t border-border/60'
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {content}
      </button>
    )
  }
  return <div className={base}>{content}</div>
}