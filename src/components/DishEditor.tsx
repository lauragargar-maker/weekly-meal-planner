import { useState, useRef, useEffect } from 'react'
import { DishIdea } from '../types'

interface DishEditorProps {
  value: string
  slot: 'starter' | 'main' | 'single'
  mealType: 'lunch' | 'dinner'
  dishIdeas: DishIdea[]
  onUpdate: (newDishName: string, selectedCategory: 'starter' | 'main' | 'single') => void
}

export default function DishEditor({ value, slot, mealType, dishIdeas, onUpdate }: DishEditorProps) {
  const [editing, setEditing] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus()
    }
  }, [editing])

  const compatibleDishes = dishIdeas.filter((dish) => {
    // Filter by meal_type compatibility
    if (dish.meal_type !== 'both' && dish.meal_type !== mealType) return false
    // For dinner main: exclude pasta dishes
    if (mealType === 'dinner' && dish.category === 'main' && dish.main_ingredient === 'pasta') return false

    // For lunch main slot: also allow single dishes
    if (slot === 'main' && mealType === 'lunch') {
      return dish.category === 'main' || dish.category === 'single'
    }
    // For single slot: also allow main dishes
    if (slot === 'single') {
      return dish.category === 'single' || dish.category === 'main'
    }
    // Default: exact category match
    return dish.category === slot
  })

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => {
          const selectedDish = dishIdeas.find((d) => d.name === e.target.value)
          const category = selectedDish?.category ?? slot
          onUpdate(e.target.value, category)
          setEditing(false)
        }}
        onBlur={() => setEditing(false)}
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
      </select>
    )
  }

  return (
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
  )
}
