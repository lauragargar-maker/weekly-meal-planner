import { useEffect, useRef } from 'react'
import { DishIdea, ShoppingIngredient } from '../types'
import { formatIngredients } from '../lib/ingredients'
import { recipeDomain, recipeSiteName } from '../lib/recipeLinks'
import { STARTER_DISH_DETAILS } from '../data/starterDishDetails'
import { trackEvent } from '../lib/analytics'

interface DishSheetProps {
  dish: DishIdea
  /** The dish's shopping ingredients, in the order they were added. */
  ingredients: ShoppingIngredient[]
  onEdit: () => void
  onClose: () => void
}

const CATEGORY_LABEL: Record<DishIdea['category'], string> = {
  starter: 'Primero',
  main: 'Segundo',
  single: 'Plato único',
}

const MEAL_LABEL: Record<DishIdea['meal_type'], string> = {
  lunch: 'Comida',
  dinner: 'Cena',
  both: 'Comida y cena',
}

const DAY_LABEL: Record<DishIdea['day_type'], string> = {
  anyday: 'Cualquier día',
  weekday: 'Entre semana',
  weekendday: 'Fin de semana',
}

/**
 * The read-only sheet a dish opens in from Platos: what it is, everything it
 * takes, and the recommended recipe. "Editar" leads to the editor.
 * docs/shopping-list-spec.md §4.1 (D7).
 */
export default function DishSheet({ dish, ingredients, onEdit, onClose }: DishSheetProps) {
  const editRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    editRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const bought = ingredients.filter((ingredient) => !ingredient.is_staple)
  const staples = ingredients.filter((ingredient) => ingredient.is_staple)
  const mainIngredients = formatIngredients(dish.main_ingredients)

  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto bg-crema-100 lg:flex lg:items-center lg:justify-center lg:bg-[rgba(38,33,28,0.5)] lg:p-7"
      onClick={(e) => {
        if (e.target === e.currentTarget && window.matchMedia('(min-width: 1024px)').matches) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-sheet-title"
        className="px-[22px] pt-5 pb-10 lg:w-[560px] lg:rounded-sheet lg:bg-crema-100 lg:px-8 lg:py-7 lg:shadow-[0_24px_60px_rgba(38,33,28,0.45)]"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="flex min-h-[44px] items-center gap-1 rounded-full text-base font-extrabold text-tinta-500 hover:text-tinta-700 focus:outline-none focus:ring-2 focus:ring-verde-500"
          >
            <span aria-hidden="true">‹</span> Platos
          </button>
          <button ref={editRef} onClick={onEdit} className="btn-dark !min-h-[44px] !px-[18px] !py-2 text-[15px]">
            <span aria-hidden="true">✎</span> Editar
          </button>
        </div>

        <h2 id="dish-sheet-title" className="mt-3 text-[30px] font-extrabold leading-[1.05] lg:text-[34px]">
          {dish.name}
        </h2>
        <div className="mt-3 flex flex-wrap gap-1.5 font-sans">
          {[CATEGORY_LABEL[dish.category], MEAL_LABEL[dish.meal_type], DAY_LABEL[dish.day_type]].map((label) => (
            <span
              key={label}
              className="rounded-full border-2 border-crema-300 bg-white px-3 py-1 text-[13px] font-extrabold text-tinta-700"
            >
              {label}
            </span>
          ))}
          {mainIngredients && (
            <span className="rounded-full border-2 border-verde-100 bg-verde-100 px-3 py-1 text-[13px] font-extrabold text-verde-700">
              {mainIngredients}
            </span>
          )}
        </div>

        <section aria-labelledby="dish-sheet-ingredients" className="card mt-5">
          <div className="flex items-baseline justify-between">
            <h3 id="dish-sheet-ingredients" className="text-xl font-extrabold">
              Ingredientes
            </h3>
            {ingredients.length > 0 && (
              <span className="font-sans text-[13px] font-bold text-tinta-500">{ingredients.length}</span>
            )}
          </div>

          {ingredients.length === 0 ? (
            <div className="mt-2 flex flex-col items-start gap-3">
              <p className="font-sans text-[15px] font-bold text-tinta-700">Este plato aún no tiene ingredientes.</p>
              <button onClick={onEdit} className="btn-secondary !min-h-[44px] !py-2 !text-verde-600">
                + Añadirlos
              </button>
            </div>
          ) : (
            <>
              {bought.length > 0 && (
                <ul className="mt-2 flex flex-col font-sans text-base font-bold">
                  {bought.map((ingredient, index) => (
                    <li
                      key={ingredient.id}
                      className={`flex items-center gap-2.5 py-2.5 ${index > 0 ? 'border-t-2 border-crema-200' : ''}`}
                    >
                      <span className="h-2 w-2 flex-none rounded-full bg-verde-600" aria-hidden="true" />
                      {ingredient.name}
                    </li>
                  ))}
                </ul>
              )}
              {staples.length > 0 && (
                <div className={bought.length > 0 ? 'mt-3 border-t-2 border-dashed border-crema-300 pt-3' : 'mt-2'}>
                  <p className="label-nam !text-xs">Básicos de casa · no van a la lista</p>
                  <ul className="flex flex-wrap gap-1.5 font-sans">
                    {staples.map((ingredient) => (
                      <li
                        key={ingredient.id}
                        className="rounded-full bg-crema-200 px-3 py-1 text-sm font-bold text-tinta-500"
                      >
                        {ingredient.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {dish.recipe_url && (
          <section aria-labelledby="dish-sheet-recipe" className="card-hoy mt-4">
            <h3 id="dish-sheet-recipe" className="text-xl font-extrabold">
              Receta recomendada
            </h3>
            <a
              href={dish.recipe_url}
              onClick={() => {
                const url = dish.recipe_url ?? ''
                trackEvent('recipe_link_opened', {
                  domain: recipeDomain(url),
                  // Still the recipe Ñam suggests for this dish, rather than one of the household's.
                  is_starter: STARTER_DISH_DETAILS[dish.name]?.recipe_url === url,
                })
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-3 w-full justify-between"
            >
              <span>Ver receta en {recipeSiteName(dish.recipe_url)}</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
              </svg>
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          </section>
        )}
      </div>
    </div>
  )
}
