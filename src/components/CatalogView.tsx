import { useMemo, useState } from 'react'
import { DishIdea, DishIngredient, NewDishIdea, ShoppingIngredient } from '../types'
import AddDishModal from './AddDishModal'
import DishSheet from './DishSheet'
import { IngredientDraft, dishesWithIngredients, ingredientsOfDish } from '../lib/dishIngredients'

interface CatalogViewProps {
  dishIdeas: DishIdea[]
  householdName: string
  /** The household's shopping ingredients and which dish takes which. */
  ingredientCatalog: ShoppingIngredient[]
  dishIngredients: DishIngredient[]
  onSaveDish: (dishData: NewDishIdea, dishId?: string, ingredients?: IngredientDraft[]) => void | Promise<void>
  onDeleteDish: (dishId: string) => void
}

type CategoryFilter = 'all' | DishIdea['category'] | 'no_ingredients'

const FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'starter', label: 'Primeros' },
  { value: 'main', label: 'Segundos' },
  { value: 'single', label: 'Únicos' },
  { value: 'no_ingredients', label: 'Sin ingredientes' },
]

const CATEGORY_LABEL: Record<DishIdea['category'], string> = {
  starter: 'Primero',
  main: 'Segundo',
  single: 'Único',
}

const MEAL_LABEL: Record<DishIdea['meal_type'], string> = {
  lunch: 'Comida',
  dinner: 'Cena',
  both: 'Ambos',
}

const DAY_LABEL: Record<DishIdea['day_type'], string> = {
  anyday: 'Cualquiera',
  weekday: 'Entre semana',
  weekendday: 'Finde',
}

export default function CatalogView({
  dishIdeas,
  householdName,
  ingredientCatalog,
  dishIngredients,
  onSaveDish,
  onDeleteDish,
}: CatalogViewProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CategoryFilter>('all')
  // The dish whose sheet is open. Kept by id so it shows the saved version
  // once the editor on top of it closes.
  const [sheetDishId, setSheetDishId] = useState<string | null>(null)
  // null = closed; 'new' = creating; a dish = editing that dish.
  const [editorTarget, setEditorTarget] = useState<null | 'new' | DishIdea>(null)

  const withIngredients = useMemo(() => dishesWithIngredients(dishIngredients), [dishIngredients])
  const sheetDish = dishIdeas.find((dish) => dish.id === sheetDishId) ?? null

  const trimmedQuery = query.trim().toLowerCase()
  const visibleDishes = dishIdeas.filter((dish) => {
    if (filter === 'no_ingredients') {
      if (withIngredients.has(dish.id)) return false
    } else if (filter !== 'all' && dish.category !== filter) return false
    if (trimmedQuery && !dish.name.toLowerCase().includes(trimmedQuery)) return false
    return true
  })

  const isFiltering = trimmedQuery.length > 0 || filter !== 'all'

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold lg:text-[30px]">Nuestros platos</h1>
          <p className="text-[13px] font-bold font-sans text-tinta-500 lg:text-[15px]">
            {dishIdeas.length} {dishIdeas.length === 1 ? 'plato' : 'platos'} en el catálogo de{' '}
            {householdName}
          </p>
        </div>
        <button
          onClick={() => setEditorTarget('new')}
          aria-label="Añadir plato"
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-verde-600 text-[22px] font-extrabold text-white transition-colors duration-120 hover:bg-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 lg:hidden"
        >
          +
        </button>
        <button onClick={() => setEditorTarget('new')} className="btn-primary hidden lg:inline-flex">
          + Añadir plato
        </button>
      </header>

      <div className="mt-3 lg:mt-5 lg:flex lg:items-center lg:gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar platos"
          className="w-full rounded-full border-2 border-crema-300 bg-white px-[18px] py-2.5 text-[15px] font-bold font-sans text-tinta-900 placeholder:text-tinta-300 focus:outline-none focus:border-tinta-900 focus:ring-2 focus:ring-verde-500 lg:max-w-[420px]"
        />

        <div className="mt-3 flex flex-wrap gap-2 lg:mt-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`chip ${filter === f.value ? 'chip-on' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {dishIdeas.length === 0 ? (
        <div className="card mx-auto mt-6 max-w-md text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-crema-200 text-[30px]"
            aria-hidden="true"
          >
            🍽
          </div>
          <h2 className="mt-[18px] text-lg font-extrabold">Vuestro catálogo está vacío</h2>
          <p className="mt-2 text-sm font-bold font-sans text-tinta-500">
            Añadid platos para que ¡Ñam! pueda montaros la semana.
          </p>
          <button onClick={() => setEditorTarget('new')} className="btn-primary mt-5 w-full">
            Añadir el primer plato
          </button>
        </div>
      ) : visibleDishes.length === 0 ? (
        <div className="mt-6 text-center">
          <p className="text-sm font-bold font-sans text-tinta-500">
            Ningún plato coincide con la búsqueda.
          </p>
          <button
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
            className="mt-2 text-[15px] font-extrabold text-verde-600 underline decoration-2 underline-offset-4 hover:text-verde-700"
          >
            Quitar filtros
          </button>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 lg:grid lg:grid-cols-3 lg:gap-3">
          {visibleDishes.map((dish) => (
            <li key={dish.id}>
              <button
                onClick={() => setSheetDishId(dish.id)}
                aria-label={`Ver ${dish.name}`}
                className="flex w-full min-h-[56px] items-center justify-between gap-3 rounded-2xl border-2 border-crema-300 bg-white px-4 py-3.5 text-left transition-[background-color,transform] duration-120 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 lg:hover:-translate-y-0.5"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold lg:text-base">{dish.name}</p>
                  <p className="text-xs font-bold font-sans text-tinta-500 lg:text-[13px]">
                    {CATEGORY_LABEL[dish.category]} · {MEAL_LABEL[dish.meal_type]} ·{' '}
                    {DAY_LABEL[dish.day_type]}
                  </p>
                </div>
                {withIngredients.has(dish.id) ? (
                  <span className="flex-none text-lg font-extrabold text-tinta-500" aria-hidden="true">
                    ›
                  </span>
                ) : (
                  <span className="flex-none rounded-full bg-amarillo-100 px-2.5 py-1 font-sans text-[11px] font-extrabold text-amarillo-700">
                    Sin ingredientes
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isFiltering && visibleDishes.length > 0 && (
        <p className="mt-4 text-center text-[13px] font-bold font-sans text-tinta-500">
          {visibleDishes.length} de {dishIdeas.length} platos
        </p>
      )}

      {sheetDish && !editorTarget && (
        <DishSheet
          dish={sheetDish}
          ingredients={ingredientsOfDish(sheetDish.id, dishIngredients, ingredientCatalog)}
          onEdit={() => setEditorTarget(sheetDish)}
          onClose={() => setSheetDishId(null)}
        />
      )}

      {editorTarget && (
        <AddDishModal
          variant="catalog"
          dishIdeas={dishIdeas}
          dish={editorTarget === 'new' ? undefined : editorTarget}
          ingredientCatalog={ingredientCatalog}
          initialIngredients={
            editorTarget === 'new'
              ? []
              : ingredientsOfDish(editorTarget.id, dishIngredients, ingredientCatalog).map(
                  ({ id, name, section, is_staple }) => ({ id, name, section, is_staple })
                )
          }
          onClose={() => setEditorTarget(null)}
          onSaveDish={(dishData, dishId, ingredients) => {
            onSaveDish(dishData, dishId, ingredients)
            // Back to the sheet when editing from it; a new dish has no sheet open.
            setEditorTarget(null)
          }}
          onDeleteDish={(dishId) => {
            onDeleteDish(dishId)
            setSheetDishId(null)
            setEditorTarget(null)
          }}
        />
      )}
    </div>
  )
}
