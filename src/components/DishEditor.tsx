import { useState, useRef, useEffect } from 'react'
import { DishIdea, NewDishIdea } from '../types'
import { formatDayName } from '../utils/menuGenerator'
import AddDishModal from './AddDishModal'

interface DishEditorProps {
  value: string
  slot: 'starter' | 'main' | 'single'
  mealType: 'lunch' | 'dinner'
  day: string // ISO date string
  dishIdeas: DishIdea[]
  onUpdate: (newDishName: string, selectedCategory: 'starter' | 'main' | 'single') => void
  onAddNewDish: (dishData: NewDishIdea) => void
}

const CATEGORY_LABELS: Record<DishIdea['category'], string> = {
  starter: 'primero',
  main: 'segundo',
  single: 'plato único',
}

const FILTERS: { value: 'all' | DishIdea['category']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'starter', label: 'Primeros' },
  { value: 'main', label: 'Segundos' },
  { value: 'single', label: 'Únicos' },
]

const isWeekendDay = (isoDate: string): boolean => {
  const d = new Date(isoDate).getDay()
  return d === 0 || d === 6
}

export default function DishEditor({ value, slot, mealType, day, dishIdeas, onUpdate, onAddNewDish }: DishEditorProps) {
  const [editing, setEditing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | DishIdea['category']>('all')
  const searchRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (editing && !showAddModal) searchRef.current?.focus()
  }, [editing, showAddModal])

  useEffect(() => {
    if (!editing) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showAddModal) closeSheet()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editing, showAddModal])

  const weekend = isWeekendDay(day)
  const compatibleDishes = dishIdeas.filter((dish) => {
    if (dish.day_type === 'weekendday' && !weekend) return false
    if (dish.day_type === 'weekday' && weekend) return false
    if (dish.meal_type !== 'both' && dish.meal_type !== mealType) return false
    if (mealType === 'dinner' && dish.category === 'main' && dish.main_ingredient === 'pasta') return false

    if (slot === 'main' && mealType === 'lunch') {
      return dish.category === 'main' || dish.category === 'single'
    }
    if (slot === 'single') {
      return dish.category === 'single' || dish.category === 'main'
    }
    return dish.category === slot
  })

  // Search and category filter are presentation only; they narrow compatibleDishes.
  const trimmedQuery = query.trim().toLowerCase()
  const visibleDishes = compatibleDishes.filter((dish) => {
    if (filter !== 'all' && dish.category !== filter) return false
    if (trimmedQuery && !dish.name.toLowerCase().includes(trimmedQuery)) return false
    return true
  })

  const closeSheet = () => {
    setEditing(false)
    setQuery('')
    setFilter('all')
    triggerRef.current?.focus()
  }

  const selectDish = (dish: DishIdea) => {
    onUpdate(dish.name, dish.category)
    closeSheet()
  }

  const handleModalConfirm = (
    name: string,
    category: 'starter' | 'main' | 'single',
    persist: boolean,
    dishData?: NewDishIdea
  ) => {
    onUpdate(name, category)
    if (persist && dishData) onAddNewDish(dishData)
    setShowAddModal(false)
    setEditing(false)
  }

  const handleModalClose = () => {
    setShowAddModal(false)
    setEditing(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Cambiar ${value}`}
        aria-haspopup="dialog"
        className={`flex w-full min-h-[44px] items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold font-sans text-tinta-900
          transition-[filter,transform] duration-120 hover:brightness-[0.97] active:scale-[0.99]
          focus:outline-none focus:ring-2 focus:ring-verde-500 ${
            mealType === 'lunch' ? 'bg-amarillo-100' : 'bg-verde-50'
          }`}
      >
        <span
          className={`flex-none text-base ${mealType === 'lunch' ? 'text-amarillo-500' : 'text-verde-500'}`}
          aria-hidden="true"
        >
          {mealType === 'lunch' ? '☀' : '☾'}
        </span>
        <span className="flex-1">{value}</span>
        <span className="flex-none text-tinta-500" aria-hidden="true">
          ✎
        </span>
      </button>

      {editing && !showAddModal && (
        <div
          className="anim-scrim fixed inset-0 z-20 flex items-end justify-center bg-[rgba(38,33,28,0.45)] lg:items-center lg:p-7"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSheet()
          }}
        >
          <div
            className="anim-sheet z-[21] max-h-[82%] w-full overflow-y-auto rounded-t-[28px] bg-white px-[22px] pt-[18px] pb-[26px] shadow-sheet lg:anim-pop lg:w-[380px] lg:rounded-sheet lg:shadow-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Cambiar ${mealType === 'lunch' ? 'la comida' : 'la cena'} del ${formatDayName(day).toLowerCase()}`}
          >
            <div className="mx-auto h-[5px] w-11 rounded bg-crema-300 lg:hidden" aria-hidden="true" />

            <h2 className="mt-[18px] text-lg font-extrabold lg:mt-0">
              {mealType === 'lunch' ? 'Comida' : 'Cena'} del {formatDayName(day).toLowerCase()}
            </h2>
            <p className="text-[13px] font-bold font-sans text-tinta-500">Ahora: {value}</p>

            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca un plato…"
              aria-label="Buscar un plato"
              className="mt-4 w-full rounded-full border-2 border-crema-300 bg-crema-100 px-[18px] py-3 text-[15px] font-bold font-sans text-tinta-900 placeholder:text-tinta-300 focus:outline-none focus:border-tinta-900 focus:ring-2 focus:ring-verde-500"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={`chip !min-h-[36px] !py-1.5 ${filter === f.value ? 'chip-on' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {visibleDishes.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {visibleDishes.map((dish) => {
                  const selected = dish.name === value
                  return (
                    <li key={dish.id}>
                      <button
                        type="button"
                        onClick={() => selectDish(dish)}
                        className={`flex w-full min-h-[44px] items-center justify-between gap-2 rounded-[14px] px-3.5 py-3 text-left transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 ${
                          selected ? 'bg-verde-50' : 'bg-crema-100 hover:bg-crema-200'
                        }`}
                      >
                        <span className="text-[15px] font-bold font-sans text-tinta-900">
                          {dish.name}
                        </span>
                        {selected ? (
                          <span className="flex-none font-extrabold text-verde-500" aria-label="Seleccionado">
                            ✓
                          </span>
                        ) : (
                          <span className="flex-none text-xs font-extrabold uppercase text-tinta-500">
                            {CATEGORY_LABELS[dish.category]}
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
              onClick={() => setShowAddModal(true)}
              className="mt-4 w-full rounded-full border-2 border-dashed border-verde-500 py-3 text-[15px] font-extrabold text-verde-500 transition-colors duration-120 hover:bg-verde-50 focus:outline-none focus:ring-2 focus:ring-verde-500"
            >
              ＋ Añadir un plato nuevo
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddDishModal
          slot={slot}
          mealType={mealType}
          dishIdeas={dishIdeas}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
        />
      )}
    </>
  )
}
