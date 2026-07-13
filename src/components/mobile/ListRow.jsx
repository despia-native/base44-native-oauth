import F7Icon from '@/components/F7Icon'

// iOS-style grouped list row. `icon` is a Framework7 Icons name string.
export default function ListRow({
  icon,
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
      {icon && (
        <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${iconBg}`}>
          <F7Icon name={icon} size={16} className={danger ? 'text-destructive' : iconColor} />
        </span>
      )}
      <span className={`flex-1 text-left text-[15px] ${danger ? 'text-destructive font-medium' : 'text-foreground'}`}>
        {label}
      </span>
      {value && <span className="text-[15px] text-muted-foreground">{value}</span>}
      {showChevron && onClick && <F7Icon name="chevron_right" size={14} className="text-muted-foreground/60" />}
    </>
  )

  const base = `flex items-center gap-3 w-full px-4 py-3 ${
    first ? '' : 'border-t border-border/60'
  }`

  if (onClick) {
    // Kit .cell press: spring scale + background highlight (no hover — press is the highlight)
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} active:bg-muted/60 transition-[transform,background-color] duration-300 [transition-timing-function:var(--spring)] active:scale-[.98]`}
      >
        {content}
      </button>
    )
  }
  return <div className={base}>{content}</div>
}