import { useState, useEffect, useRef } from 'react'
import { DishIdea, NewDishIdea } from '../types'

interface AddDishModalProps {
  slot: 'starter' | 'main' | 'single'
  mealType: 'lunch' | 'dinner'
  dishIdeas: DishIdea[]
  onClose: () => void
  onConfirm: (
    name: string,
    category: 'starter' | 'main' | 'single',
    persist: boolean,
    dishData?: NewDishIdea
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
          <h2 className="text-lg font-bold text-gray-900">Añadir plato nuevo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del plato</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={handleNameChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="p. ej. Merluza a la plancha"
          />
          {isDuplicate && (
            <p className="mt-1 text-sm text-red-600">
              Ya existe un plato con este nombre: selecciónalo en la lista
            </p>
          )}
        </div>

        {canProceed && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Añadir este plato:</p>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="dish-mode"
                value="instance"
                checked={mode === 'instance'}
                onChange={() => setMode('instance')}
                className="text-primary-600"
              />
              <span className="text-sm text-gray-800">Solo esta vez</span>
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
              <span className="text-sm text-gray-800">Guardarlo en mi catálogo para próximas semanas</span>
            </label>
          </div>
        )}

        {mode === 'persist' && (
          <div className="mb-4 space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="starter">Primero</option>
                <option value="main">Segundo</option>
                <option value="single">Plato único</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Momento del día</label>
              <select
                value={formMealType}
                onChange={(e) => setFormMealType(e.target.value as typeof formMealType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="lunch">Comida</option>
                <option value="dinner">Cena</option>
                <option value="both">Ambas</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de día</label>
              <select
                value={dayType}
                onChange={(e) => setDayType(e.target.value as typeof dayType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="anyday">Cualquier día</option>
                <option value="weekday">Entre semana</option>
                <option value="weekendday">Fin de semana</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ingrediente principal{' '}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <select
                value={mainIngredient}
                onChange={(e) => setMainIngredient(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— Ninguno —</option>
                <option value="pasta">Pasta</option>
                <option value="meat">Carne</option>
                <option value="fish">Pescado</option>
                <option value="egg">Huevo</option>
                <option value="legume">Legumbre</option>
                <option value="vegetable">Verdura</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
