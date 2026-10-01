import { useEffect, useRef } from 'react'
import { MenuItem } from '../types'
import { formatDayName } from '../utils/menuGenerator'
import CompactMeals from './CompactMeals'

/** A day the open one can be swapped with, as the week shows it. */
export interface SwapCandidate {
  day: string
  lunch: MenuItem | null
  dinner: MenuItem | null
  /** Already happened this week: dimmed like in the week, but still a choice. */
  past: boolean
}

interface SwapDayPickerProps {
  /** "Martes 14", the day being swapped away. */
  dayTitle: string
  /** Every other day of the same week, in calendar order. */
  candidates: SwapCandidate[]
  onPick: (day: string) => void
  /** ‹ — back to the day, changing nothing. */
  onBack: () => void
  /** ✕ — closes the whole thing. Only the mobile sheet passes it. */
  onClose?: () => void
}

/**
 * Step 2 of the day editor when the whole day is to be swapped with another
 * one. A sibling of `DishPicker`: same header, same ‹ and ✕, same place in the
 * sheet and in the panel, so it reads as one more thing the day can do rather
 * than a new screen.
 *
 * Choosing a day is the whole commitment. There is no confirmation, because the
 * swap is undone from the toast that follows it, and because it cannot break a
 * house rule: both meals of each day travel together (`lib/swapDays.ts`).
 */
export default function SwapDayPicker({
  dayTitle,
  candidates,
  onPick,
  onBack,
  onClose,
}: SwapDayPickerProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Same landing spot as the dish picker: the title announces the step and puts
  // the keyboard next to the ‹.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver al día"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-crema-100 text-lg font-extrabold text-tinta-900 transition-colors duration-120 hover:bg-crema-200 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-extrabold leading-tight focus:outline-none"
          >
            ¿Con qué día cambias el {dayTitle.toLowerCase()}?
          </h2>
          <p className="text-[12.5px] font-bold font-sans text-tinta-500">
            Se cambian la comida y la cena de los dos días.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-crema-100 text-lg font-extrabold text-tinta-900 transition-colors duration-120 hover:bg-crema-200 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
          >
            ✕
          </button>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {candidates.map(({ day, lunch, dinner, past }) => (
          <li key={day}>
            <button
              type="button"
              onClick={() => onPick(day)}
              className={`flex w-full min-h-[56px] items-center gap-3 rounded-[16px] border-2 border-crema-300 bg-white px-3.5 py-3 text-left transition-colors duration-120 hover:border-tinta-900 hover:bg-crema-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
                past ? 'opacity-[0.55]' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[15px] font-extrabold text-tinta-900">
                  <span className="sr-only">Intercambiar con el </span>
                  {formatDayName(day)} {new Date(day).getDate()}
                </p>
                <CompactMeals lunch={lunch} dinner={dinner} />
              </div>
              <span
                aria-hidden="true"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-crema-100 text-base font-extrabold text-tinta-900"
              >
                ⇄
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
