import { useState, useEffect, useRef } from 'react'
import { DishIdea, NewDishIdea } from '../types'

interface AddDishModalProps {
  /** 'menu' picks a dish for a meal slot; 'catalog' creates or edits a catalogue dish. */
  variant?: 'menu' | 'catalog'
  slot?: 'starter' | 'main' | 'single'
  mealType?: 'lunch' | 'dinner'
  dishIdeas: DishIdea[]
  /** The dish being edited, when opened from the catalogue. */
  dish?: DishIdea
  onClose: () => void
  onConfirm?: (
    name: string,
    category: 'starter' | 'main' | 'single',
    persist: boolean,
    dishData?: NewDishIdea
  ) => void
  onSaveDish?: (dishData: NewDishIdea, dishId?: string) => void
  onDeleteDish?: (dishId: string) => void
}

const CATEGORIES: { value: DishIdea['category']; label: string }[] = [
  { value: 'starter', label: 'Primero' },
  { value: 'main', label: 'Segundo' },
  { value: 'single', label: 'Plato único' },
]

const DAY_TYPES: { value: DishIdea['day_type']; label: string }[] = [
  { value: 'anyday', label: 'Cualquier día' },
  { value: 'weekday', label: 'Entre semana' },
  { value: 'weekendday', label: 'Fin de semana' },
]

const MEAL_TYPES: { value: DishIdea['meal_type']; label: string }[] = [
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'both', label: 'Ambas' },
]

const INGREDIENTS: { value: string; label: string }[] = [
  { value: 'pasta', label: 'Pasta' },
  { value: 'meat', label: 'Carne' },
  { value: 'fish', label: 'Pescado' },
  { value: 'egg', label: 'Huevo' },
  { value: 'legume', label: 'Legumbre' },
  { value: 'vegetable', label: 'Verdura' },
]

export default function AddDishModal({
  variant = 'menu',
  slot = 'main',
  mealType = 'lunch',
  dishIdeas,
  dish,
  onClose,
  onConfirm,
  onSaveDish,
  onDeleteDish,
}: AddDishModalProps) {
  const isCatalog = variant === 'catalog'
  const isEditingDish = Boolean(dish)

  const [name, setName] = useState(dish?.name ?? '')
  const [mode, setMode] = useState<null | 'instance' | 'persist'>(null)
  const [category, setCategory] = useState<'starter' | 'main' | 'single'>(dish?.category ?? slot)
  const [formMealType, setFormMealType] = useState<'lunch' | 'dinner' | 'both'>(dish?.meal_type ?? mealType)
  const [dayType, setDayType] = useState<'weekday' | 'weekendday' | 'anyday'>(dish?.day_type ?? 'anyday')
  const [mainIngredient, setMainIngredient] = useState<string>(dish?.main_ingredient ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (confirmingDelete) cancelDeleteRef.current?.focus()
  }, [confirmingDelete])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmingDelete) setConfirmingDelete(false)
      else onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, confirmingDelete])

  const trimmedName = name.trim()
  const isDuplicate =
    trimmedName !== '' &&
    dishIdeas.some(
      (d) => d.id !== dish?.id && d.name.toLowerCase() === trimmedName.toLowerCase()
    )
  const canProceed = trimmedName !== '' && !isDuplicate
  const canSubmit = isCatalog ? canProceed : canProceed && mode !== null

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    if (!isCatalog) setMode(null)
  }

  const dishData = (): NewDishIdea => ({
    name: trimmedName,
    category,
    meal_type: formMealType,
    day_type: dayType,
    main_ingredient: mainIngredient ? (mainIngredient as DishIdea['main_ingredient']) : undefined,
  })

  const handleSubmit = () => {
    if (!canSubmit) return
    if (isCatalog) {
      onSaveDish?.(dishData(), dish?.id)
      return
    }
    if (mode === 'instance') {
      onConfirm?.(trimmedName, slot, false)
    } else {
      onConfirm?.(trimmedName, category, true, dishData())
    }
  }

  /** Chips behaving as a radio group. Passing null as value clears the selection. */
  const ChipGroup = <T extends string>({
    label,
    options,
    value,
    onChange,
    clearable,
  }: {
    label: string
    options: { value: T; label: string }[]
    value: T | ''
    onChange: (v: T | '') => void
    clearable?: boolean
  }) => (
    <div className="mt-[18px] lg:mt-5">
      <p className="label-nam" id={`group-${label}`}>
        {label}
      </p>
      <div
        className="mt-2 flex flex-wrap gap-2"
        role="radiogroup"
        aria-labelledby={`group-${label}`}
        onKeyDown={(e) => {
          // Arrow keys move between options, as expected of a radiogroup.
          const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
          if (step === 0) return
          e.preventDefault()
          const current = options.findIndex((o) => o.value === value)
          const next = (current + step + options.length) % options.length
          onChange(options[next].value)
          const buttons = e.currentTarget.querySelectorAll('button')
          buttons[next]?.focus()
        }}
      >
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (value === '' && option === options[0]) ? 0 : -1}
              onClick={() => onChange(clearable && selected ? '' : option.value)}
              className={`chip focus:ring-offset-0 ${selected ? 'chip-on' : '!bg-crema-100 lg:!bg-white'}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto bg-white lg:flex lg:items-center lg:justify-center lg:bg-[rgba(38,33,28,0.5)] lg:p-7"
      onClick={(e) => {
        // Only the desktop scrim closes on click; on mobile the sheet is the whole screen.
        if (e.target === e.currentTarget && window.matchMedia('(min-width: 1024px)').matches) {
          onClose()
        }
      }}
    >
      <div
        className="px-6 pt-6 pb-8 lg:w-[560px] lg:rounded-sheet lg:bg-crema-100 lg:py-7 lg:px-8 lg:shadow-[0_24px_60px_rgba(38,33,28,0.45)]"
        role="dialog"
        aria-modal="true"
        aria-label={isEditingDish ? 'Editar plato' : 'Añadir plato'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold lg:text-2xl">
            {isEditingDish ? 'Editar plato' : 'Añadir plato'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-crema-100 font-extrabold text-tinta-500 transition-colors duration-120 hover:bg-crema-200 focus:outline-none focus:ring-2 focus:ring-verde-500 lg:h-[38px] lg:w-[38px] lg:bg-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-5">
          <label className="label-nam" htmlFor="dish-name">
            Nombre del plato
          </label>
          <input
            ref={inputRef}
            id="dish-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="p. ej. Merluza a la plancha"
            className={`w-full rounded-2xl border-2 bg-crema-100 px-4 py-3 text-base font-bold font-sans text-tinta-900 placeholder:text-tinta-300 focus:outline-none focus:ring-2 focus:ring-verde-500 lg:bg-white lg:text-[17px] ${
              isDuplicate ? 'border-rojo-500' : 'border-tinta-900'
            }`}
          />
          {isDuplicate && (
            <p className="error-nam" role="alert">
              Ya existe un plato con este nombre: selecciónalo en la lista
            </p>
          )}
        </div>

        {!isCatalog && canProceed && (
          <div className="mt-[18px] lg:mt-5">
            <p className="label-nam">¿Lo guardamos?</p>
            <div className="flex flex-col gap-2">
              {([
                ['instance', 'Solo esta vez'],
                ['persist', 'Guardarlo en nuestro catálogo'],
              ] as const).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left text-[15px] font-extrabold transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 ${
                    mode === value ? 'border-verde-500 bg-verde-50' : 'border-crema-300 hover:bg-crema-100'
                  }`}
                >
                  <span
                    className={`h-[18px] w-[18px] flex-none rounded-full ${
                      mode === value ? 'bg-verde-500' : 'border-2 border-crema-400'
                    }`}
                    aria-hidden="true"
                  />
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {(isCatalog || mode === 'persist') && (
          <>
            <ChipGroup label="Tipo de plato" options={CATEGORIES} value={category} onChange={(v) => v && setCategory(v)} />
            <ChipGroup label="¿Cuándo se come?" options={DAY_TYPES} value={dayType} onChange={(v) => v && setDayType(v)} />
            <ChipGroup label="Momento del día" options={MEAL_TYPES} value={formMealType} onChange={(v) => v && setFormMealType(v)} />
            <ChipGroup
              label="Ingrediente principal (opcional)"
              options={INGREDIENTS}
              value={mainIngredient}
              onChange={(v) => setMainIngredient(v)}
              clearable
            />
          </>
        )}

        <button onClick={handleSubmit} disabled={!canSubmit} className="btn-dark mt-[22px] w-full">
          {isEditingDish ? 'Guardar cambios' : 'Guardar plato'}
        </button>

        {isCatalog && isEditingDish && (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="mt-3 w-full py-2 text-[15px] font-extrabold text-rojo-500 hover:text-rojo-600 focus:outline-none focus:ring-2 focus:ring-rojo-500 focus:ring-offset-2 rounded-full"
          >
            Borrar este plato
          </button>
        )}
      </div>

      {confirmingDelete && dish && (
        <div
          className="fixed inset-0 z-[45] flex items-center justify-center bg-[rgba(38,33,28,0.5)] p-7"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmingDelete(false)
          }}
        >
          <div
            className="anim-pop max-w-[320px] rounded-[26px] bg-crema-100 py-[26px] px-6 text-center shadow-modal"
            role="alertdialog"
            aria-modal="true"
            aria-label={`Borrar ${dish.name}`}
          >
            <div
              className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-full bg-rojo-100 text-[28px]"
              aria-hidden="true"
            >
              🗑
            </div>
            <h3 className="mt-4 text-xl font-extrabold leading-[1.2]">¿Borrar «{dish.name}»?</h3>
            <p className="mt-2 text-sm font-bold font-sans leading-[1.4] text-tinta-500">
              Se quitará del catálogo de la casa. No afecta a las semanas ya planificadas.
            </p>
            <button onClick={() => onDeleteDish?.(dish.id)} className="btn-danger mt-5 w-full">
              Sí, borrar
            </button>
            <button
              ref={cancelDeleteRef}
              onClick={() => setConfirmingDelete(false)}
              className="mt-1 w-full rounded-full py-3 text-[15px] font-extrabold text-tinta-500 hover:text-tinta-700 focus:outline-none focus:ring-2 focus:ring-verde-500"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
