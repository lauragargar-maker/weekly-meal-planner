import { useState, useRef, useEffect } from 'react'
import { DishIdea } from '../types'
import AddDishModal from './AddDishModal'

interface DishEditorProps {
  value: string
  slot: 'starter' | 'main' | 'single'
  mealType: 'lunch' | 'dinner'
  day: string // ISO date string
  dishIdeas: DishIdea[]
  onUpdate: (newDishName: string, selectedCategory: 'starter' | 'main' | 'single') => void
  onAddNewDish: (dishData: Omit<DishIdea, 'id' | 'created_at' | 'updated_at'>) => void
}

const isWeekendDay = (isoDate: string): boolean => {
  const d = new Date(isoDate).getDay()
  return d === 0 || d === 6
}

export default function DishEditor({ value, slot, mealType, day, dishIdeas, onUpdate, onAddNewDish }: DishEditorProps) {
  const [editing, setEditing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (editing && !showAddModal && selectRef.current) {
      selectRef.current.focus()
    }
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

  const handleModalConfirm = (
    name: string,
    category: 'starter' | 'main' | 'single',
    persist: boolean,
    dishData?: Omit<DishIdea, 'id' | 'created_at' | 'updated_at'>
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
      {editing && !showAddModal ? (
        <select
          ref={selectRef}
          value={value}
          onChange={(e) => {
            const val = e.target.value
            if (val === '__add_new__') {
              setShowAddModal(true)
              return
            }
            const selectedDish = dishIdeas.find((d) => d.name === val)
            const category = selectedDish?.category ?? slot
            onUpdate(val, category)
            setEditing(false)
          }}
          onBlur={() => {
            if (!showAddModal) setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
          }}
          className="text-inherit bg-white border border-primary-300 rounded px-1 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {compatibleDishes.map((dish) => (
            <option key={dish.id} value={dish.name}>
              {dish.name}{dish.category !== slot ? ` (${dish.category})` : ''}
            </option>
          ))}
          <option value="__add_new__">+ Add new dish...</option>
        </select>
      ) : !showAddModal ? (
        <span className="inline-flex items-center gap-1 group">
          <span>{value}</span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-primary-600 p-0.5"
            aria-label={`Edit ${value}`}
            title="Edit dish"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </span>
      ) : null}

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
