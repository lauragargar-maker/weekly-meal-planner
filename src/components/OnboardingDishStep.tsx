import { useState } from 'react'
import { HouseholdRules } from '../lib/householdRules'
import { INGREDIENTS, formatIngredients } from '../lib/ingredients'
import { CatalogRequirement, getCatalogRequirements } from '../utils/catalogCheck'
import { Ingredient, NewDishIdea } from '../types'

/**
 * Step 3: the dishes the house starts with (onboarding-v2.md §4 and §4b).
 *
 * Everything arrives accepted, so a household that does not want to browse taps
 * the CTA and is in. The whole row is the control — one tap discards, another
 * brings it back — with no submenus and no swipe.
 */
export default function OnboardingDishStep({
  dishes,
  discarded,
  onToggle,
  rules,
  onChangeRules,
  onAddDish,
  onSubmit,
  submitting,
  seedCount,
}: {
  /** Everything on offer: the seed catalogue plus anything added by hand. */
  dishes: NewDishIdea[]
  discarded: Set<string>
  onToggle: (name: string) => void
  rules: HouseholdRules
  /** Goes back to step 2, keeping the discards made here. */
  onChangeRules: () => void
  onAddDish: () => void
  onSubmit: () => void
  submitting: boolean
  seedCount: number
}) {
  const [filter, setFilter] = useState<Ingredient | 'all'>('all')

  const kept = dishes.filter((dish) => !discarded.has(dish.name))
  const requirements = getCatalogRequirements(kept, rules)
  const unmet = requirements.filter((requirement) => !requirement.met)
  const enough = unmet.length === 0

  const visible =
    filter === 'all' ? dishes : dishes.filter((dish) => dish.main_ingredients.includes(filter))

  // Which filter chips to tint amber: the ingredients the missing minimums are
  // about, so the user can jump straight to the shortage. Position never moves.
  // Requirements about a course rather than an ingredient — starters for dinner,
  // say — tint nothing, because no chip corresponds to them.
  const shortIngredients = new Set<Ingredient>(
    unmet
      .map((requirement) => requirement.ingredient)
      .filter((ingredient): ingredient is Ingredient => Boolean(ingredient))
  )

  return (
    <>
      <h1 className="mt-5 text-[26px] font-extrabold leading-[1.15]">Tus platos de base</h1>
      <p className="mt-2 text-sm font-bold font-sans leading-[1.4] text-tinta-500">
        Platos fáciles y saludables que iremos combinando en planes semanales. Quita, añade o
        déjalo tal cual. Podrás editar más adelante.
      </p>

      <SufficiencyIndicator
        enough={enough}
        keptCount={kept.length}
        unmet={unmet}
        onChangeRules={onChangeRules}
      />

      <div className="mt-3.5 flex flex-wrap gap-2">
        <FilterChip
          label="Todos"
          active={filter === 'all'}
          short={false}
          onClick={() => setFilter('all')}
        />
        {INGREDIENTS.map((ingredient) => (
          <FilterChip
            key={ingredient.value}
            label={ingredient.label}
            active={filter === ingredient.value}
            short={shortIngredients.has(ingredient.value)}
            onClick={() => setFilter(ingredient.value)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {visible.map((dish) => {
          const isDiscarded = discarded.has(dish.name)
          return (
            <button
              key={dish.name}
              type="button"
              aria-pressed={!isDiscarded}
              onClick={() => onToggle(dish.name)}
              className={`flex min-h-14 items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
                isDiscarded
                  ? 'border-2 border-dashed border-crema-300 bg-crema-100'
                  : 'border-2 border-crema-300 bg-white hover:bg-crema-100'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-base font-extrabold ${
                    isDiscarded ? 'text-tinta-400 line-through' : ''
                  }`}
                >
                  {dish.name}
                </span>
                <span className="mt-0.5 block text-[12.5px] font-bold font-sans text-tinta-500">
                  {isDiscarded
                    ? 'Descartado · toca para recuperarlo'
                    : formatIngredients(dish.main_ingredients) || 'Sin ingredientes'}
                </span>
              </span>
              <span
                className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-lg font-extrabold ${
                  isDiscarded ? 'bg-white text-tinta-900' : 'bg-verde-500 text-white'
                }`}
                aria-hidden="true"
              >
                {isDiscarded ? '+' : '✓'}
              </span>
            </button>
          )
        })}

        {/* Always last, whatever the filter and whether or not dishes are short. */}
        <button
          type="button"
          onClick={onAddDish}
          className="flex min-h-14 items-center gap-3 rounded-2xl border-[3px] border-dashed border-tinta-900 bg-white px-3.5 py-3 text-left transition-colors duration-120 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base font-extrabold">Añadir un plato mío</span>
            <span className="mt-0.5 block text-[12.5px] font-bold font-sans text-tinta-500">
              Uno que no esté en la lista
            </span>
          </span>
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-tinta-900 text-lg font-extrabold text-crema-100"
            aria-hidden="true"
          >
            +
          </span>
        </button>
      </div>

      <p className="mt-3 text-center text-[13px] font-bold font-sans text-tinta-500">
        {kept.length} de {dishes.length} platos
        {dishes.length !== seedCount && ' (con los tuyos)'}
      </p>

      <div className="sticky bottom-0 -mx-[22px] mt-3.5 border-t-2 border-crema-200 bg-white px-[22px] pt-3.5 pb-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!enough || submitting}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:bg-crema-400 disabled:text-crema-100"
        >
          {submitting && (
            <span
              className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
          )}
          {submitting ? 'Creando la casa…' : 'Empezar con estos platos'}
        </button>
      </div>
    </>
  )
}

function FilterChip({
  label,
  active,
  short,
  onClick,
}: {
  label: string
  active: boolean
  short: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      // 33px tall by design, so the touch target is grown with a pseudo-element
      // instead of by making the chip look bigger than the ones on Platos.
      className={`relative rounded-full border-2 px-3.5 py-1.5 text-[13px] font-extrabold transition-colors duration-120 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
        active
          ? 'border-tinta-900 bg-tinta-900 text-crema-100'
          : short
            ? 'border-amarillo-500 bg-amarillo-100 text-amarillo-700'
            : 'border-crema-300 bg-white text-tinta-900 hover:bg-crema-100'
      }`}
    >
      {label}
    </button>
  )
}

function SufficiencyIndicator({
  enough,
  keptCount,
  unmet,
  onChangeRules,
}: {
  enough: boolean
  keptCount: number
  unmet: CatalogRequirement[]
  onChangeRules: () => void
}) {
  const worst = enough
    ? null
    : [...unmet].sort((a, b) => b.need - b.have - (a.need - a.have))[0]

  return (
    <div
      className={`mt-4 flex flex-col gap-2 rounded-2xl px-3.5 py-3 ${
        enough ? 'bg-verde-100' : 'border-2 border-amarillo-500 bg-amarillo-100'
      }`}
      role="status"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-sm font-extrabold ${
            enough ? 'bg-verde-500 text-white' : 'bg-amarillo-500 text-tinta-900'
          }`}
          aria-hidden="true"
        >
          {enough ? '✓' : '!'}
        </span>
        <span
          className={`text-sm font-extrabold ${enough ? 'text-verde-700' : 'text-amarillo-700'}`}
        >
          {enough
            ? `${keptCount} platos · suficientes para tus semanas`
            : `Faltan ${worst!.need - worst!.have} · ${worst!.label.toLowerCase()}`}
        </span>
      </div>

      <div
        className={`flex min-h-9 items-center justify-between gap-3 border-t-2 pt-2 ${
          enough ? 'border-verde-500/30' : 'border-amarillo-500/40'
        }`}
      >
        <span
          className={`text-[13px] font-bold font-sans ${
            enough ? 'text-verde-700' : 'text-amarillo-700'
          }`}
        >
          {enough ? 'Calculado con tus reglas' : 'Añádelos o suaviza las reglas'}
        </span>
        <button
          type="button"
          onClick={onChangeRules}
          className={`flex-none px-2 py-2.5 text-[13.5px] font-extrabold underline decoration-2 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
            enough ? 'text-verde-700' : 'text-amarillo-700'
          }`}
        >
          Cambiar reglas
        </button>
      </div>
    </div>
  )
}
