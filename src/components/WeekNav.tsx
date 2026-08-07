import { formatLocalDate, formatWeekRange, weekEndFor, weekStartFor } from '../utils/weekStart'

interface WeekNavProps {
  /** Which week is on screen, in weeks from the current one. Negative is the past. */
  weekOffset: number
  canGoBack: boolean
  canGoForward: boolean
  onNavigate: (direction: -1 | 1) => void
}

/**
 * The label is derived rather than enumerated, so it keeps making sense if the
 * navigation range is ever widened past one week either way.
 */
const weekLabel = (offset: number): string => {
  if (offset === 0) return 'SEMANA ACTUAL'
  if (offset === 1) return 'PRÓXIMA SEMANA'
  if (offset === -1) return 'SEMANA PASADA'
  return offset < 0 ? `HACE ${-offset} SEMANAS` : `DENTRO DE ${offset} SEMANAS`
}

/**
 * Week heading and its two arrows. It reads the dates off the offset and not
 * off a menu, because a week with no menu saved still has to be navigable —
 * otherwise landing on an empty past week is a dead end.
 */
export default function WeekNav({ weekOffset, canGoBack, canGoForward, onNavigate }: WeekNavProps) {
  const weekStart = weekStartFor(weekOffset)
  const range = formatWeekRange(formatLocalDate(weekStart), formatLocalDate(weekEndFor(weekStart)))
  const label = weekLabel(weekOffset)

  // after:-inset-1 widens the tap target to 44px on mobile without changing the 36px visual.
  const navButton = (direction: -1 | 1, disabled: boolean, ariaLabel: string, glyph: string) => (
    <button
      onClick={() => onNavigate(direction)}
      disabled={disabled}
      className="relative flex h-9 w-9 flex-none items-center justify-center rounded-xl border-2 border-crema-300 bg-white text-lg font-extrabold text-tinta-500 transition-colors duration-120 after:absolute after:-inset-1 after:content-[''] hover:bg-crema-100 active:scale-[0.96] focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:text-crema-400 disabled:opacity-40 lg:h-11 lg:w-11 lg:rounded-[14px] lg:after:hidden"
      aria-label={ariaLabel}
    >
      {glyph}
    </button>
  )

  return (
    <div className="flex items-center justify-between gap-3 lg:justify-center lg:gap-6">
      {navButton(-1, !canGoBack, 'Ir a la semana anterior', '‹')}
      <div className="text-center">
        <p className="hidden text-[13px] font-extrabold tracking-[0.08em] text-verde-500 lg:block">
          {label}
        </p>
        <h2 className="text-lg font-extrabold lg:text-[30px]">{range}</h2>
        <p className="text-xs font-extrabold tracking-[0.08em] text-verde-500 lg:hidden">{label}</p>
      </div>
      {navButton(1, !canGoForward, 'Ir a la semana siguiente', '›')}
    </div>
  )
}
