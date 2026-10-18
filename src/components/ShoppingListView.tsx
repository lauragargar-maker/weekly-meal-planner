import { ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ShoppingIngredient, ShoppingList, ShoppingListItem, StoreSection } from '../types'
import { ListStatus, formatListText, formatRange, formatSources, groupBySection, shortDay } from '../lib/shoppingList'
import { searchIngredients } from '../lib/dishIngredients'
import { toKey } from '../lib/nameKey'
import { STORE_SECTIONS } from '../lib/storeSections'
import { ITEM_NAME_MAX_LENGTH, ShoppingListState } from '../lib/useShoppingList'
import { trackEvent } from '../lib/analytics'

interface ShoppingListViewProps {
  list: ShoppingList
  items: ShoppingListItem[]
  status: ListStatus
  /** The menu changed since the list was made (§5.7). */
  stale: boolean
  userId: string | null
  catalog: ShoppingIngredient[]
  actions: Pick<ShoppingListState, 'toggle' | 'addManual' | 'removeItem' | 'setSection' | 'clearChecked'>
  saveError: string | null
  onClearSaveError: () => void
  onRegenerate: () => Promise<void>
  onChooseDays: () => void
  onCompleteMissing: () => void
  onClose: () => void
}

/** "hace 2 h", "hace 5 min", "ayer"… close enough for "is this today's list?". */
const timeAgo = (iso: string): string => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

/**
 * The household's shopping list (docs/shopping-list-spec.md §5.5): grouped by
 * supermarket section, ticked items sinking to the end of theirs, things added
 * by hand, and the notices that say what the list leaves out or that the menu
 * has moved on since. A closed list (§5.10) leads with a card and the way to
 * the next one.
 */
export default function ShoppingListView({
  list,
  items,
  status,
  stale,
  userId,
  catalog,
  actions,
  saveError,
  onClearSaveError,
  onRegenerate,
  onChooseDays,
  onCompleteMissing,
  onClose,
}: ShoppingListViewProps) {
  const [draft, setDraft] = useState('')
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [regenerating, setRegenerating] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const addId = useId()
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const closed = status !== 'active'
  const pending = items.filter((item) => !item.checked)
  const done = items.length - pending.length
  const groups = useMemo(() => groupBySection(items), [items])
  const listKeys = useMemo(() => new Set(items.map((item) => toKey(item.name))), [items])
  const suggestions = useMemo(() => searchIngredients(draft, catalog, listKeys, 5), [draft, catalog, listKeys])

  const flash = (message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  useEffect(() => {
    closeRef.current?.focus()
    return () => clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    if (!saveError) return
    flash(saveError)
    onClearSaveError()
  }, [saveError, onClearSaveError])

  useEffect(() => {
    if (stale && !closed) trackEvent('shopping_list_stale_shown')
  }, [stale, closed])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const add = async (name: string) => {
    if (!name.trim()) return
    setDraft('')
    const result = await actions.addManual(name)
    if (result === 'exists') flash('Ya estaba en la lista')
    if (result === 'reopened') flash('Vuelve a estar pendiente')
  }

  const copyText = formatListText(list, items)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      flash('Lista copiada')
      trackEvent('shopping_list_copied', { item_count: pending.length })
    } catch {
      flash('No se pudo copiar')
    }
  }
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: copyText })
        trackEvent('shopping_list_shared', { item_count: pending.length })
        return
      }
      await copy()
    } catch (err) {
      // Closing the share sheet lands here too; only real failures are worth a word.
      if (err instanceof Error && err.name !== 'AbortError') flash('No se pudo compartir')
    }
  }

  const regenerate = async () => {
    setRegenerating(true)
    try {
      await onRegenerate()
      flash('Lista rehecha')
    } catch (err) {
      console.error('Error regenerating shopping list:', err)
      flash('No se pudo rehacer la lista')
    } finally {
      setRegenerating(false)
    }
  }

  const dismiss = (key: string) => setDismissed((current) => new Set(current).add(key))
  const madeBy = list.generated_by && list.generated_by === userId ? 'hecha por ti ' : 'hecha '

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-crema-100">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-list-title"
        className="mx-auto flex min-h-full max-w-[640px] flex-col px-[22px] pb-[calc(32px+env(safe-area-inset-bottom))] pt-5 lg:pt-8"
      >
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="shopping-list-title" className="text-2xl font-extrabold leading-tight">
                Lista de la compra
              </h2>
              <p className="font-sans text-[13px] font-bold text-tinta-500">
                {formatRange(list.days)} · {list.days.length} {list.days.length === 1 ? 'día' : 'días'} · {madeBy}
                {timeAgo(list.generated_at)}
              </p>
            </div>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-white text-lg font-extrabold text-tinta-900 focus:outline-none focus:ring-2 focus:ring-verde-500"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={copy} disabled={pending.length === 0} className="btn-secondary min-h-[44px] flex-1 !px-3 !py-2 !text-tinta-900 disabled:opacity-50">
              Copiar
            </button>
            <button onClick={share} disabled={pending.length === 0} className="btn-secondary min-h-[44px] flex-1 !px-3 !py-2 !text-tinta-900 disabled:opacity-50">
              Compartir
            </button>
            {!closed && (
              <button onClick={onChooseDays} className="btn-secondary min-h-[44px] basis-full !px-3 !py-2 !text-tinta-900">
                Elegir otros días
              </button>
            )}
          </div>

          {items.length > 0 && (
            <div>
              <div className="mb-1.5 flex justify-between font-sans text-[13px] font-extrabold text-tinta-500">
                <span>{pending.length} por comprar</span>
                <span>
                  {done} de {items.length} en el carro
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-crema-300"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={items.length}
                aria-valuenow={done}
                aria-label="Comprado"
              >
                <div className="h-full rounded-full bg-verde-600 transition-[width] duration-240" style={{ width: `${(done / items.length) * 100}%` }} />
              </div>
            </div>
          )}
        </header>

        {closed && (
          <section role="status" className="card-hoy mt-4 flex flex-col gap-3">
            <h3 className="text-2xl font-extrabold leading-tight">
              {status === 'all_checked' ? '¡Todo comprado!' : 'Esta lista ya ha pasado'}
            </h3>
            <p className="font-sans text-[15px] font-semibold leading-snug text-tinta-700">
              {status === 'all_checked'
                ? 'La lista queda cerrada. Cuando quieras, haz la de los próximos días.'
                : `Era para ${formatRange(list.days)} y esos días ya han pasado. Podéis seguir consultándola, pero el botón de Semana ya no la abre.`}
            </p>
            <button onClick={onChooseDays} className="btn-primary w-full">
              Elegir otros días
            </button>
          </section>
        )}

        {!closed && (
          <div className="mt-3 flex flex-col gap-2">
            {stale && (
              <div role="status" className="flex items-center gap-2.5 rounded-[18px] border-2 border-amarillo-500 bg-amarillo-100 py-2.5 pl-3.5 pr-2.5">
                <span className="flex-1 font-sans text-sm font-bold leading-snug text-tinta-900">
                  El menú ha cambiado desde que hiciste esta lista.
                </span>
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="flex-none rounded-full bg-tinta-900 px-3.5 py-2 text-sm font-extrabold text-crema-100 hover:bg-tinta-700 focus:outline-none focus:ring-2 focus:ring-tinta-900 focus:ring-offset-2 disabled:opacity-60"
                >
                  {regenerating ? 'Rehaciendo…' : 'Regenerar'}
                </button>
              </div>
            )}
            {list.skipped_days.length > 0 && !dismissed.has('skipped') && (
              <Notice onDismiss={() => dismiss('skipped')}>
                No incluye {list.skipped_days.map(shortDay).join(', ')}: no tenían menú.
              </Notice>
            )}
            {list.missing_dishes.length > 0 && !dismissed.has('missing') && (
              <Notice onDismiss={() => dismiss('missing')} action={{ label: 'Completar', onClick: onCompleteMissing }}>
                No incluye ingredientes de <strong className="text-tinta-900">{list.missing_dishes.join(', ')}</strong>.
              </Notice>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            add(draft)
          }}
          className="mt-4"
        >
          <label htmlFor={addId} className="sr-only">
            Añadir artículo
          </label>
          <div className="flex gap-2">
            <input
              id={addId}
              type="text"
              value={draft}
              maxLength={ITEM_NAME_MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Añadir artículo…"
              autoComplete="off"
              className="input-nam min-w-0 flex-1"
            />
            <button type="submit" aria-label="Añadir" disabled={!draft.trim()} className="btn-primary h-12 w-12 flex-none !p-0 text-2xl">
              +
            </button>
          </div>
          {suggestions.length > 0 && (
            <ul aria-label="Sugerencias" className="mt-1.5 flex flex-wrap gap-2">
              {suggestions.map((ingredient) => (
                <li key={ingredient.id}>
                  <button
                    type="button"
                    onClick={() => add(ingredient.name)}
                    className="min-h-[40px] rounded-full border-2 border-dashed border-crema-400 px-3.5 text-sm font-extrabold text-tinta-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-verde-500"
                  >
                    + {ingredient.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <main className="mt-4 flex flex-col gap-4">
          {items.length === 0 && (
            <p className="card text-center font-sans text-sm font-bold text-tinta-500">
              No hay nada que comprar para estos días. Podéis añadir artículos a mano.
            </p>
          )}
          {groups.map((group) => (
            <section key={group.section} aria-labelledby={`sec-${group.section}`}>
              <h3 id={`sec-${group.section}`} className="label-nam ml-1">
                {group.label} <span className="text-tinta-300">· {group.items.filter((i) => !i.checked).length}</span>
              </h3>
              <ul className="overflow-hidden rounded-card border-2 border-crema-300 bg-white">
                {group.items.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    first={index === 0}
                    open={openItem === item.id}
                    onToggle={() => actions.toggle(item)}
                    onMenu={() => setOpenItem(openItem === item.id ? null : item.id)}
                    onRemove={() => {
                      setOpenItem(null)
                      actions.removeItem(item)
                      flash('Quitado de la lista')
                    }}
                    onStaple={() => {
                      setOpenItem(null)
                      actions.removeItem(item, true)
                      flash('No volverá a salir en vuestras listas')
                    }}
                    onSection={(section) => actions.setSection(item, section)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {done > 0 && !closed && (
            <button
              onClick={actions.clearChecked}
              className="self-center rounded-full px-4 py-2.5 text-[15px] font-extrabold text-rojo-600 hover:text-rojo-500 focus:outline-none focus:ring-2 focus:ring-rojo-500"
            >
              Borrar los ya comprados
            </button>
          )}
        </main>
      </div>

      {toast && (
        <div
          role="status"
          className="anim-toast fixed bottom-[calc(24px+env(safe-area-inset-bottom))] left-1/2 z-40 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-tinta-900 px-5 py-3 text-sm font-extrabold text-crema-100 shadow-toast"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function Notice({
  children,
  action,
  onDismiss,
}: {
  children: ReactNode
  action?: { label: string; onClick: () => void }
  onDismiss: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-[18px] border-2 border-crema-300 bg-white py-2 pl-3.5 pr-1.5">
      <span className="flex-1 font-sans text-sm font-bold leading-snug text-tinta-700">{children}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="flex-none rounded-full border-2 border-crema-300 px-3 py-1.5 text-sm font-extrabold text-verde-600 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-verde-500"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Ocultar aviso"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-lg font-extrabold text-tinta-400 hover:text-tinta-700 focus:outline-none focus:ring-2 focus:ring-verde-500"
      >
        ×
      </button>
    </div>
  )
}

function ItemRow({
  item,
  first,
  open,
  onToggle,
  onMenu,
  onRemove,
  onStaple,
  onSection,
}: {
  item: ShoppingListItem
  first: boolean
  open: boolean
  onToggle: () => void
  onMenu: () => void
  onRemove: () => void
  onStaple: () => void
  onSection: (section: StoreSection) => void
}) {
  const sectionId = useId()
  return (
    <li className={first ? '' : 'border-t-2 border-crema-200'}>
      <div className="flex items-center gap-1 py-1 pl-1.5 pr-1">
        <label className="flex min-h-[52px] min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-1.5 focus-within:ring-2 focus-within:ring-verde-500">
          <input type="checkbox" checked={item.checked} onChange={onToggle} className="sr-only" />
          <span
            aria-hidden="true"
            className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border-2 text-sm font-extrabold text-white transition-colors duration-120 ${
              item.checked ? 'border-verde-600 bg-verde-600' : 'border-crema-400 bg-white'
            }`}
          >
            {item.checked && '✓'}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={`text-[17px] font-extrabold leading-tight ${item.checked ? 'text-tinta-400 line-through' : 'text-tinta-900'}`}>
              {item.name}
            </span>
            <span className="truncate font-sans text-xs font-bold text-tinta-400">{formatSources(item)}</span>
          </span>
        </label>
        <button
          onClick={onMenu}
          aria-label={`Más opciones para ${item.name}`}
          aria-expanded={open}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-tinta-400 hover:bg-crema-100 hover:text-tinta-700 focus:outline-none focus:ring-2 focus:ring-verde-500"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2.5 px-3 pb-3 pl-[50px]">
          {item.sources.length > 2 && (
            <ul className="font-sans text-[13px] font-bold text-tinta-500">
              {item.sources.map((source) => (
                <li key={`${source.day}-${source.meal}-${source.dish}`}>
                  {source.dish} · {shortDay(source.day)} {source.meal === 'lunch' ? 'comida' : 'cena'}
                </li>
              ))}
            </ul>
          )}
          {item.origin === 'manual' && (
            <div>
              <label htmlFor={sectionId} className="label-nam !text-xs">
                Sección
              </label>
              <select
                id={sectionId}
                value={item.section}
                onChange={(e) => onSection(e.target.value as StoreSection)}
                className="input-nam min-h-[44px] !py-2"
              >
                {STORE_SECTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={onRemove} className="chip">
              Quitar de la lista
            </button>
            {item.ingredient_id && (
              <button onClick={onStaple} className="chip">
                Siempre lo tengo en casa
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

