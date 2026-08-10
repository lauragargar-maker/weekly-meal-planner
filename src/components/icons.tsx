/**
 * Line icons from the design handoff (`Redesign - handoff docs/assets/`),
 * inlined rather than loaded as files so they inherit `currentColor` and can be
 * sized per spec. They are decorative: the label next to them (or the button's
 * `aria-label`) carries the meaning.
 */

interface IconProps {
  /** Rendered size in px; the specs give a different one per placement. */
  size?: number
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

/** Calendar with three dots — the weekly plan. */
export function IconSemana({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className={className}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
      <circle cx="8.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** A plate seen from above — the dish catalogue. */
export function IconPlatos({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.6" />
    </svg>
  )
}

/** A house — the household. */
export function IconFamilia({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className={className}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M9.5 21v-5.5h5V21" />
    </svg>
  )
}

/**
 * Speech bubble with three dots. Chosen over a smiley (reads as "my profile" in
 * that corner of a header) and over a note with a pencil (the pencil already
 * means "edit" in this app).
 */
export function IconFeedback({ size = 23, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.4} className={className}>
      <path d="M4 5.5h16v11H10l-5 4v-4H4z" />
      <circle cx="9" cy="11" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="11" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="16" cy="11" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  )
}
