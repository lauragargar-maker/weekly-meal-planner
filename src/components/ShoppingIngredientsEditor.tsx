import { useId, useMemo, useState } from 'react'
import { ShoppingIngredient, StoreSection } from '../types'
import { guessIngredient } from '../data/starterIngredients'
import {
  INGREDIENT_NAME_MAX_LENGTH,
  IngredientDraft,
  MAX_DISH_INGREDIENTS,
  searchIngredients,
} from '../lib/dishIngredients'
import { cleanName, toKey } from '../lib/nameKey'
import { STORE_SECTIONS } from '../lib/storeSections'

interface ShoppingIngredientsEditorProps {
  value: IngredientDraft[]
  onChange: (next: IngredientDraft[]) => void
  /** The household's ingredient catalogue, for the suggestions. */
  catalog: ShoppingIngredient[]
}

/**
 * The "what does this dish take" block of the dish editor: a field with
 * suggestions from the household's catalogue, the chips of what is already in,
 * and — on tapping a chip — its section and the "Básico de casa" switch.
 * docs/shopping-list-spec.md §4.2.
 */
export default function ShoppingIngredientsEditor({ value, onChange, catalog }: ShoppingIngredientsEditorProps) {
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const inputId = useId()
  const listId = useId()

  const takenKeys = useMemo(() => new Set(value.map((draft) => toKey(draft.name))), [value])
  const matches = useMemo(() => searchIngredients(query, catalog, takenKeys), [query, catalog, takenKeys])
  const typed = cleanName(query)
  const typedKey = toKey(typed)
  const exactInCatalog = catalog.find((ingredient) => ingredient.name_key === typedKey)
  const isFull = value.length >= MAX_DISH_INGREDIENTS
  const canCreate = typed !== '' && !exactInCatalog && !takenKeys.has(typedKey)

  const add = (draft: IngredientDraft) => {
    setQuery('')
    if (isFull || takenKeys.has(toKey(draft.name))) return
    onChange([...value, draft])
  }

  const addExisting = (ingredient: ShoppingIngredient) =>
    add({ id: ingredient.id, name: ingredient.name, section: ingredient.section, is_staple: ingredient.is_staple })

  const addTyped = () => {
    if (!typed) return
    if (exactInCatalog) {
      addExisting(exactInCatalog)
      return
    }
    add({ name: typed.charAt(0).toLocaleUpperCase('es') + typed.slice(1), ...guessIngredient(typed) })
  }

  const update = (key: string, patch: Partial<IngredientDraft>) =>
    onChange(value.map((draft) => (toKey(draft.name) === key ? { ...draft, ...patch } : draft)))

  const remove = (key: string) => {
    setSelectedKey(null)
    onChange(value.filter((draft) => toKey(draft.name) !== key))
  }

  const selected = value.find((draft) => toKey(draft.name) === selectedKey) ?? null
  // Bought first, staples after, each in the order they were added — the same
  // order the dish sheet shows.
  const ordered = [...value.filter((d) => !d.is_staple), ...value.filter((d) => d.is_staple)]
  const showSuggestions = typed !== '' && (matches.length > 0 || canCreate)

  return (
    <div className="mt-[18px] lg:mt-5">
      <label className="label-nam" htmlFor={inputId}>
        Ingredientes para la compra
      </label>
      <p className="help-nam !mt-0 mb-2">
        Todo lo que hay que tener para hacerlo, salsas incluidas. Lo que siempre hay en casa sale como básico y no va a la
        lista.
      </p>

      <input
        id={inputId}
        type="text"
        value={query}
        maxLength={INGREDIENT_NAME_MAX_LENGTH}
        disabled={isFull}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Enter adds the ingredient instead of submitting the dish.
            e.preventDefault()
            addTyped()
          } else if (e.key === 'Escape' && query) {
            // Clears the field rather than closing the whole editor.
            e.stopPropagation()
            setQuery('')
          }
        }}
        placeholder={isFull ? `Máximo ${MAX_DISH_INGREDIENTS} ingredientes` : 'Escribe un ingrediente…'}
        autoComplete="off"
        aria-controls={showSuggestions ? listId : undefined}
        className="input-nam !bg-crema-100 lg:!bg-white"
      />

      {showSuggestions && (
        <ul
          id={listId}
          aria-label="Sugerencias"
          className="mt-1.5 flex flex-col gap-0.5 rounded-2xl border-2 border-tinta-900 bg-white p-1.5 shadow-pop-sm"
        >
          {matches.map((ingredient) => (
            <li key={ingredient.id}>
              <button
                type="button"
                onClick={() => addExisting(ingredient)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3 text-left font-sans text-[15px] font-bold text-tinta-900 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-verde-500"
              >
                {ingredient.name}
                {ingredient.is_staple && (
                  <span className="text-xs font-bold text-tinta-400">Básico de casa</span>
                )}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                onClick={addTyped}
                className="flex min-h-[44px] w-full items-center rounded-xl px-3 text-left font-sans text-[15px] font-extrabold text-verde-600 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-verde-500"
              >
                + Añadir «{typed}»
              </button>
            </li>
          )}
        </ul>
      )}

      {ordered.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Ingredientes del plato">
          {ordered.map((draft) => {
            const key = toKey(draft.name)
            const isOpen = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                aria-expanded={isOpen}
                onClick={() => setSelectedKey(isOpen ? null : key)}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-2 px-3.5 text-[15px] font-extrabold transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 ${
                  isOpen
                    ? 'border-tinta-900 bg-tinta-900 text-crema-100'
                    : draft.is_staple
                      ? 'border-crema-200 bg-crema-200 text-tinta-500'
                      : 'border-tinta-900 bg-white text-tinta-900'
                }`}
              >
                {draft.name}
                {draft.is_staple && (
                  <span className={`text-[11px] uppercase tracking-[0.06em] ${isOpen ? 'text-crema-300' : 'text-tinta-400'}`}>
                    básico
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-3 font-sans text-sm font-bold text-tinta-400">Aún no hay ingredientes.</p>
      )}

      {selected && (
        <IngredientPanel
          draft={selected}
          onSection={(section) => update(toKey(selected.name), { section })}
          onStaple={(is_staple) => update(toKey(selected.name), { is_staple })}
          onRemove={() => remove(toKey(selected.name))}
        />
      )}
    </div>
  )
}

function IngredientPanel({
  draft,
  onSection,
  onStaple,
  onRemove,
}: {
  draft: IngredientDraft
  onSection: (section: StoreSection) => void
  onStaple: (isStaple: boolean) => void
  onRemove: () => void
}) {
  const sectionId = useId()
  const stapleId = useId()
  return (
    <div className="anim-pop mt-3 flex flex-col gap-3 rounded-[20px] border-[3px] border-tinta-900 bg-white p-4 shadow-pop-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-extrabold">{draft.name}</p>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-[40px] rounded-full px-3 text-sm font-extrabold text-rojo-600 hover:text-rojo-500 focus:outline-none focus:ring-2 focus:ring-rojo-500"
        >
          Quitar del plato
        </button>
      </div>
      <div>
        <label className="label-nam !text-xs" htmlFor={sectionId}>
          Sección del súper
        </label>
        <select
          id={sectionId}
          value={draft.section}
          onChange={(e) => onSection(e.target.value as StoreSection)}
          className="input-nam min-h-[48px] !py-2"
        >
          {STORE_SECTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <label htmlFor={stapleId} className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-base font-extrabold">Básico de casa</span>
          <span className="font-sans text-[13px] font-bold text-tinta-500">Siempre lo tenéis; no va a la lista</span>
        </span>
        <input
          id={stapleId}
          type="checkbox"
          role="switch"
          checked={draft.is_staple}
          onChange={(e) => onStaple(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors duration-120 peer-focus-visible:ring-2 peer-focus-visible:ring-verde-500 peer-focus-visible:ring-offset-2 ${
            draft.is_staple ? 'bg-verde-600' : 'bg-crema-400'
          }`}
        >
          <span
            className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-[left] duration-180 ${
              draft.is_staple ? 'left-[25px]' : 'left-[3px]'
            }`}
          />
        </span>
      </label>
      {draft.id && (
        <p className="rounded-xl bg-amarillo-100 px-3 py-2 font-sans text-[13px] font-bold text-amarillo-700">
          Se aplicará en todos vuestros platos que llevan {draft.name.toLocaleLowerCase('es')}.
        </p>
      )}
    </div>
  )
}
