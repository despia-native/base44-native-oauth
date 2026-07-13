// Framework7 Icons — the SF Symbols-style iOS icon font.
// <F7Icon name="chevron_left" size={22} className="text-primary" />
// Icon names: https://framework7.io/icons/ (underscored, e.g. person_crop_circle).
// The glyph is sized by font-size, so `size` drives everything; color comes
// from currentColor → Tailwind text-* classes work as usual.
export default function F7Icon({ name, size = 20, className = '', ...props }) {
  return (
    <i
      className={`f7-icons select-none shrink-0 ${className}`}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
      {...props}
    >
      {name}
    </i>
  )
}