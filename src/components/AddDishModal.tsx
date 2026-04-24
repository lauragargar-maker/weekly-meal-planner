import { useState, useEffect, useRef } from 'react'
import { DishIdea } from '../types'

interface AddDishModalProps {
  slot: 'starter' | 'main' | 'single'
  mealType: 'lunch' | 'dinner'
  dishIdeas: DishIdea[]
  onClose: () => void
  onConfirm: (
    name: string,
    category: 'starter' | 'main' | 'single',
    persist: boolean,
    dishData?: Omit<DishIdea, 'id' | 'created_at' | 'updated_at'>
  ) => void
}

export default function AddDishModal({ slot, mealType, dishIdeas, onClose, onConfirm }: AddDishModalProps) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<null | 'instance' | 'persist'>(null)
  const [category, setCategory] = useState<'starter' | 'main' | 'single'>(slot)
  const [formMealType, setFormMealType] = useState<'lunch' | 'dinner' | 'both'>(mealType)
  const [dayType, setDayType] = useState<'weekday' | 'weekendday' | 'anyday'>('anyday')
  const [mainIngredient, setMainIngredient] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const trimmedName = name.trim()
  const isDuplicate =
    trimmedName !== '' &&
    dishIdeas.some((d) => d.name.toLowerCase() === trimmedName.toLowerCase())
  const canProceed = trimmedName !== '' && !isDuplicate
  const canSubmit = canProceed && mode !== null

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    setMode(null)
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    if (mode === 'instance') {
      onConfirm(trimmedName, slot, false)
    } else {
      onConfirm(trimmedName, category, true, {
        name: trimmedName,
        category,
        meal_type: formMealType,
        day_type: dayType,
        main_ingredient: mainIngredient ? (mainIngredient as DishIdea['main_ingredient']) : undefined,
      })
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Add new dish</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Dish name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={handleNameChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g. Pasta carbonara"
          />
          {isDuplicate && (
            <p className="mt-1 text-sm text-red-600">
              Ya existe un plato con este nombre — selecciónalo de la lista
            </p>
          )}
        </div>

        {canProceed && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Add this dish:</p>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="dish-mode"
                value="instance"
                checked={mode === 'instance'}
                onChange={() => setMode('instance')}
                className="text-primary-600"
              />
              <span className="text-sm text-gray-800">Only this time</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="dish-mode"
                value="persist"
                checked={mode === 'persist'}
                onChange={() => setMode('persist')}
                className="text-primary-600"
              />
              <span className="text-sm text-gray-800">Add to my dish ideas for future weeks</span>
            </label>
          </div>
        )}

        {mode === 'persist' && (
          <div className="mb-4 space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="starter">Starter</option>
                <option value="main">Main</option>
                <option value="single">Single</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meal type</label>
              <select
                value={formMealType}
                onChange={(e) => setFormMealType(e.target.value as typeof formMealType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day type</label>
              <select
                value={dayType}
                onChange={(e) => setDayType(e.target.value as typeof dayType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="anyday">Any day</option>
                <option value="weekday">Weekday</option>
                <option value="weekendday">Weekend day</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Main ingredient{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={mainIngredient}
                onChange={(e) => setMainIngredient(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— None —</option>
                <option value="pasta">Pasta</option>
                <option value="meat">Meat</option>
                <option value="fish">Fish</option>
                <option value="egg">Egg</option>
                <option value="legume">Legume</option>
                <option value="vegetable">Vegetable</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
