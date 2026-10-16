import { useEffect, useMemo, useRef, useState } from 'react'
import { WeeklyMenu } from '../types'
import { formatLocalDate } from '../utils/weekStart'
import {
  defaultSelection,
  dishesOfDay,
  formatRange,
  longDay,
  menuItemsByDay,
  parseDay,
  selectableDays,
  shortDay,
} from '../lib/shoppingList'

interface ShoppingDayPickerProps {
  /** This week's and next week's menus; null while they load. */
  menus: WeeklyMenu[] | null
  /** Set when the household has a closed list, to reach it from here. */
  previousRange: string | null
  /** True when generating will replace a list still in progress. */
  replacesActiveList: boolean
  onGenerate: (days: string[]) => Promise<void>
  onOpenPrevious: () => void
  onShowNextWeek: () => void
  onClose: () => void
}

type Preset = 'default' | 'week' | 'none' | 'custom'

/**
 * "¿Para qué días compras?" (docs/shopping-list-spec.md §5.2). Whole days from
 * today to the end of next week; tomorrow and the four days after start
 * ticked. A day with no menu can be ticked but says so, and the list leaves it
 * out (D3) — this screen never generates a menu.
 */
export default function ShoppingDayPicker({
  menus,
  previousRange,
  replacesActiveList,
  onGenerate,
  onOpenPrevious,
  onShowNextWeek,
  onClose,
}: ShoppingDayPickerProps) {
  // Fixed for as long as the picker is open, so midnight cannot move the rows.
  const today = useMemo(() => new Date(), [])
  const days = useMemo(() => selectableDays(today), [today])
  const todayKey = formatLocalDate(today)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelection(today)))
  const [preset, setPreset] = useState<Preset>('default')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return
      if (confirming) setConfirming(false)
      else onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, confirming, busy])

  const byDay = useMemo(() => menuItemsByDay(menus ?? []), [menus])
  const dishesOn = (day: string) => dishesOfDay(byDay.get(day) ?? []).map((d) => d.name)
  const hasMenu = (day: string) => dishesOn(day).length > 0

  // Monday of next week splits the list in two.
  const splitAt = days.findIndex((day) => day > todayKey && parseDay(day).getDay() === 1)
  const groups = [
    { title: 'Esta semana', days: splitAt === -1 ? days : days.slice(0, splitAt) },
    { title: 'Semana que viene', days: splitAt === -1 ? [] : days.slice(splitAt) },
  ].filter((group) => group.days.length > 0)

  const chosen = days.filter((day) => selected.has(day))
  const withMenu = chosen.filter(hasMenu)
  const withoutMenu = menus ? chosen.filter((day) => !hasMenu(day)) : []

  const toggle = (day: string) => {
    setPreset('custom')
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const applyPreset = (next: Preset) => {
    setPreset(next)
    if (next === 'default') setSelected(new Set(defaultSelection(today)))
    if (next === 'week') setSelected(new Set(days.filter((day) => day > todayKey && (splitAt === -1 || day < days[splitAt]))))
    if (next === 'none') setSelected(new Set())
  }

  const generate = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await onGenerate(withMenu.concat(withoutMenu))
    } catch (err) {
      console.error('Error generating shopping list:', err)
      setFailed(true)
      setBusy(false)
      setConfirming(false)
    }
  }

  const presets: { value: Preset; label: string }[] = [
    { value: 'default', label: 'Próximos 5 días' },
    { value: 'week', label: 'Solo esta semana' },
    { value: 'none', label: 'Ninguno' },
  ]

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-crema-100 lg:items-center lg:bg-[rgba(38,33,28,0.5)] lg:p-7">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-picker-title"
        className="flex min-h-full w-full flex-col lg:min-h-0 lg:max-w-[560px] lg:overflow-hidden lg:rounded-sheet lg:bg-crema-100 lg:shadow-[0_24px_60px_rgba(38,33,28,0.45)]"
      >
        <header className="flex items-center gap-2 px-[22px] pt-5 lg:px-8 lg:pt-7">
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Volver"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-white text-[22px] font-extrabold text-tinta-900 focus:outline-none focus:ring-2 focus:ring-verde-500"
          >
            ‹
          </button>
          <div>
            <h2 id="day-picker-title" className="text-2xl font-extrabold leading-tight">
              Lista de la compra
            </h2>
            <p className="font-sans text-[13px] font-bold text-tinta-500">¿Para qué días compras?</p>
          </div>
        </header>

        {previousRange && (
          <button
            onClick={onOpenPrevious}
            className="ml-[74px] mt-1 flex min-h-[44px] items-center self-start font-sans text-sm font-extrabold text-verde-600 underline decoration-2 underline-offset-4 hover:text-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-500 lg:ml-[82px]"
          >
            Ver la lista anterior ({previousRange}) ›
          </button>
        )}

        <div className="flex flex-wrap gap-2 px-[22px] pt-3 lg:px-8">
          {presets.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={preset === value}
              onClick={() => applyPreset(value)}
              className={`chip ${preset === value ? 'chip-on' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 px-[22px] pb-4 pt-2 lg:px-8">
          {groups.map((group) => (
            <fieldset key={group.title} className="flex min-w-0 flex-col gap-2">
              <legend className="label-nam px-1 pt-3">{group.title}</legend>
              {group.days.map((day) => {
                const isOn = selected.has(day)
                const names = dishesOn(day)
                const empty = menus !== null && names.length === 0
                return (
                  <label
                    key={day}
                    className={`flex cursor-pointer items-center gap-3 rounded-[18px] border-2 px-3.5 py-2.5 transition-colors duration-120 focus-within:ring-2 focus-within:ring-verde-500 ${
                      isOn ? 'border-verde-600 bg-white' : empty ? 'border-crema-300 bg-transparent' : 'border-crema-300 bg-white'
                    } ${empty ? 'min-h-[52px]' : 'min-h-[64px]'}`}
                  >
                    <input type="checkbox" checked={isOn} onChange={() => toggle(day)} className="sr-only" />
                    <span
                      aria-hidden="true"
                      className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border-2 text-sm font-extrabold text-white ${
                        isOn ? 'border-verde-600 bg-verde-600' : 'border-crema-400 bg-white'
                      }`}
                    >
                      {isOn && '✓'}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[17px] font-extrabold">{longDay(day)}</span>
                        {day === todayKey && (
                          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-verde-600">Hoy</span>
                        )}
                      </span>
                      {names.length > 0 && (
                        <span className="truncate font-sans text-[13px] font-bold text-tinta-500">{names.join(' · ')}</span>
                      )}
                    </span>
                    {empty && (
                      <span className="flex-none rounded-full bg-crema-200 px-2.5 py-0.5 font-sans text-xs font-extrabold text-tinta-500">
                        Sin menú
                      </span>
                    )}
                  </label>
                )
              })}
            </fieldset>
          ))}
        </div>

        <footer className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t-2 border-crema-300 bg-white px-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5 lg:px-8">
          {withoutMenu.length > 0 && (
            <div role="status" className="flex gap-2.5 rounded-[18px] border-2 border-amarillo-500 bg-amarillo-100 px-3.5 py-3">
              <span
                aria-hidden="true"
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-amarillo-500 text-xs font-extrabold text-tinta-900"
              >
                !
              </span>
              <div className="font-sans text-sm font-bold leading-snug text-tinta-700">
                <span className="font-extrabold text-tinta-900">
                  {withoutMenu.length === 1
                    ? '1 día no tiene menú planificado'
                    : `${withoutMenu.length} días no tienen menú planificado`}
                </span>{' '}
                y no {withoutMenu.length === 1 ? 'entrará' : 'entrarán'} en la lista: {withoutMenu.map(shortDay).join(', ')}.{' '}
                <button
                  onClick={onShowNextWeek}
                  className="font-extrabold text-amarillo-700 underline decoration-2 underline-offset-2 focus:outline-none focus:ring-2 focus:ring-amarillo-500"
                >
                  Ver semana que viene ›
                </button>
              </div>
            </div>
          )}
          {failed && (
            <p className="error-nam !mt-0" role="alert">
              No se pudo hacer la lista. Revisa la conexión y vuelve a probar.
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="font-sans text-sm font-bold leading-tight text-tinta-500">
              <span className="block text-lg font-extrabold font-display text-tinta-900">
                {menus === null ? 'Cargando menús…' : withMenu.length === 1 ? '1 día con menú' : `${withMenu.length} días con menú`}
              </span>
              {withMenu.length > 0 && formatRange(withMenu)}
            </p>
            <button
              onClick={() => (replacesActiveList ? setConfirming(true) : generate())}
              disabled={menus === null || withMenu.length === 0 || busy}
              className="btn-primary flex-none"
            >
              {busy ? 'Haciendo la lista…' : 'Generar lista'}
            </button>
          </div>
        </footer>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[45] flex items-center justify-center bg-[rgba(38,33,28,0.5)] p-7">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="replace-title"
            className="anim-pop max-w-[340px] rounded-[26px] bg-crema-100 px-6 py-[26px] text-center shadow-modal"
          >
            <h3 id="replace-title" className="text-xl font-extrabold leading-tight">
              ¿Sustituir la lista actual?
            </h3>
            <p className="mt-2 font-sans text-sm font-bold leading-snug text-tinta-500">
              Conservaremos lo que ya habéis marcado y lo que añadisteis a mano.
            </p>
            <button onClick={generate} disabled={busy} className="btn-primary mt-5 w-full">
              {busy ? 'Haciendo la lista…' : 'Sí, hacer la nueva'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
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
