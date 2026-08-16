import { useEffect, useId, useRef, useState } from 'react'
import { DishIdea, Ingredient } from '../types'
import { INGREDIENTS, formatIngredients } from '../lib/ingredients'

interface DishPickerProps {
  /** "Cena · primero" */
  title: string
  /** "Viernes 24 · ahora: Crema de calabacín" */
  subtitle: string
  /** Already narrowed to the meal — see `eligibleDishesFor`. */
  dishes: DishIdea[]
  /** The dish currently in the slot, ticked in the list. Absent when adding one. */
  currentDish?: string
  /** The house rule this dish would break, if any (`ruleWarningFor`). */
  warningFor: (dish: DishIdea) => string | null
  onPick: (dish: DishIdea) => void
  /** ‹ — back to the day, changing nothing. */
  onBack: () => void
  /** ✕ — closes the whole thing. Only the mobile sheet passes it (§0). */
  onClose?: () => void
  onRequestNewDish: () => void
}

type IngredientFilter = 'all' | Ingredient

/**
 * Step 2 of the day sheet on mobile, the body of the side panel on desktop
 * (`specs/edit-day.md` §4). It owns no scrim, no sheet and no modal of its own —
 * that is the whole point of the round: there is never a second layer.
 */
export default function DishPicker({
  title,
  subtitle,
  dishes,
  currentDish,
  warningFor,
  onPick,
  onBack,
  onClose,
  onRequestNewDish,
}: DishPickerProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<IngredientFilter>('all')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const warningId = useId()

  // §5: arriving at this step moves the focus to its title, which both announces
  // the step and puts the keyboard where the ‹ is. The search box is a worse
  // landing spot: on mobile it opens the keyboard over half the list.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const trimmedQuery = query.trim().toLowerCase()
  const visibleDishes = dishes.filter(dish => {
    if (filter !== 'all' && !dish.main_ingredients.includes(filter)) return false
    if (trimmedQuery && !dish.name.toLowerCase().includes(trimmedQuery)) return false
    return true
  })

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
            {title}
          </h2>
          <p className="text-[12.5px] font-bold font-sans text-tinta-500">{subtitle}</p>
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

      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar un plato…"
        aria-label="Buscar un plato"
        className="mt-3.5 w-full rounded-full border-2 border-crema-300 bg-crema-100 px-[18px] py-3 text-[15px] font-bold font-sans text-tinta-900 placeholder:text-tinta-300 focus:outline-none focus:border-tinta-900 focus:ring-2 focus:ring-verde-500"
      />

      {/* Ingredients only: no "Va bien aquí", no course filter, no hidden
          ranking. Same chip as the onboarding dish step, down to the 44px touch
          target grown with a pseudo-element. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[{ value: 'all' as const, label: 'Todos' }, ...INGREDIENTS].map(({ value, label }) => {
          const active = filter === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(value)}
              className={`relative rounded-full border-2 px-3.5 py-1.5 text-[13px] font-extrabold transition-colors duration-120 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
                active
                  ? 'border-tinta-900 bg-tinta-900 text-crema-100'
                  : 'border-crema-300 bg-white text-tinta-900 hover:bg-crema-100'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {visibleDishes.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {visibleDishes.map(dish => {
            const selected = dish.name === currentDish
            const warning = warningFor(dish)
            return (
              <li key={dish.id}>
                <button
                  type="button"
                  onClick={() => onPick(dish)}
                  // The rule note is spoken as well as coloured: on the row it is
                  // told apart by amber alone, which nobody reading with their
                  // ears (or their eyes on a sunny kitchen counter) can use.
                  aria-describedby={warning ? `${warningId}-${dish.id}` : undefined}
                  className={`flex w-full min-h-[52px] items-center justify-between gap-3 rounded-[14px] border-2 px-3.5 py-3 text-left transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 ${
                    selected
                      ? 'border-verde-100 bg-verde-50'
                      : warning
                        ? 'border-crema-300 bg-amarillo-100 hover:brightness-[0.98]'
                        : 'border-crema-300 bg-white hover:bg-crema-100'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-base font-extrabold text-tinta-900">
                      {dish.name}
                    </span>
                    <span
                      id={warning ? `${warningId}-${dish.id}` : undefined}
                      className={`block text-xs font-bold font-sans ${
                        warning ? 'text-amarillo-700' : 'text-tinta-500'
                      }`}
                    >
                      {formatIngredients(dish.main_ingredients) || 'Sin ingredientes'}
                      {warning ? ` · ${warning}` : ''}
                    </span>
                  </span>
                  {selected ? (
                    <span className="flex-none text-lg font-extrabold text-verde-600">
                      {/* aria-label on a plain span is not reliably announced. */}
                      <span className="sr-only">Es el plato de ahora</span>
                      <span aria-hidden="true">✓</span>
                    </span>
                  ) : (
                    <span
                      className="flex-none text-xl font-extrabold text-verde-600"
                      aria-hidden="true"
                    >
                      ＋
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-6 text-center text-sm font-bold font-sans text-tinta-500">
          No hay platos que encajen aquí.
        </p>
      )}

      <button
        type="button"
        onClick={onRequestNewDish}
        className="mt-4 w-full rounded-full py-3 text-sm font-extrabold text-verde-600 transition-colors duration-120 hover:bg-verde-50 focus:outline-none focus:ring-2 focus:ring-verde-500"
      >
        Añadir un plato nuevo
      </button>
    </div>
  )
}
