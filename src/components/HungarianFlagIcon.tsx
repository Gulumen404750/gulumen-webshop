/** Magyar zászló ikon (piros–fehér–zöld), újrahasználható. */
export function HungarianFlagIcon({
  width = 20,
  height = 14,
  className = '',
  title = 'Magyar zászló',
}: {
  width?: number
  height?: number
  className?: string
  title?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded overflow-hidden border border-[var(--border)] ${className}`}
      style={{ width, height }}
      title={title}
      aria-hidden="true"
    >
      <svg viewBox="0 0 3 2" className="w-full h-full" preserveAspectRatio="none">
        <rect y="0" width="3" height="0.667" fill="#cd2a1e" />
        <rect y="0.667" width="3" height="0.667" fill="#fff" />
        <rect y="1.333" width="3" height="0.667" fill="#477050" />
      </svg>
    </span>
  )
}
