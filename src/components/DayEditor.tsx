import { ReactNode, useEffect, useRef, useState } from 'react'
import { DishIdea, Ingredient, MenuItem, NewDishIdea } from '../types'
import { formatDayName } from '../utils/menuGenerator'
import {
  CourseSlot,
  DayCourse,
  MealType,
  coursesOf,
  eligibleDishesFor,
  formatControlFor,
  ruleWarningFor,
} from '../lib/dayFormat'
import { HouseholdRules } from '../lib/householdRules'
import AddDishModal from './AddDishModal'
import DishPicker from './DishPicker'

interface DayEditorProps {
  /** ISO date of the day being edited. */
  day: string
  lunch: MenuItem | null
  dinner: MenuItem | null
  dishIdeas: DishIdea[]
  rules: HouseholdRules
  /** Modal bottom sheet below 1024 px, panel beside the week above it (§0). */
  surface: 'sheet' | 'panel'
  onClose: () => void
  onReplaceCourse: (mealType: MealType, slot: CourseSlot, dishName: string) => void
  onAddFirstCourse: (mealType: MealType, dishName: string) => void
  onRemoveFirstCourse: (mealType: MealType) => void
  onAddNewDish: (dishData: NewDishIdea) => void
}

/** What the picker is being opened for. `add` has no dish to replace yet. */
interface PickTarget {
  mealType: MealType
  slot: CourseSlot
  mode: 'replace' | 'add'
  /** The dish in that slot today, for the subtitle and the ✓. */
  current?: string
}

const DRAG_CLOSE_THRESHOLD_PX = 90

const MEAL_LABEL: Record<MealType, string> = { lunch: 'Comida', dinner: 'Cena' }

/** "primero" / "segundo" / "plato principal", for the picker title. */
const slotWord = (target: PickTarget, courses: DayCourse[]): string =>
  target.mode === 'add'
    ? 'primero'
    : (courses.find(course => course.slot === target.slot)?.role ?? 'plato').toLowerCase()

/**
 * Editing one day: the list of its dishes, the per-day format controls, and the
 * dish picker — `specs/edit-day.md` §2-§4.
 *
 * The two surfaces are the same content in different containers, and which one
 * is used is the caller's decision (`surface`). They are never both mounted:
 * two dialogs sharing one truth is exactly the stacked-layers problem this
 * round set out to remove.
 */
export default function DayEditor({
  day,
  lunch,
  dinner,
  dishIdeas,
  rules,
  surface,
  onClose,
  onReplaceCourse,
  onAddFirstCourse,
  onRemoveFirstCourse,
  onAddNewDish,
}: DayEditorProps) {
  const [pick, setPick] = useState<PickTarget | null>(null)
  const [addingDish, setAddingDish] = useState(false)
  // Which way the step slid in, so ‹ undoes the movement that brought you here.
  const [goingBack, setGoingBack] = useState(false)
  const [dragY, setDragY] = useState(0)

  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)

  const isSheet = surface === 'sheet'
  const dayTitle = `${formatDayName(day)} ${new Date(day).getDate()}`

  // On desktop the panel stays open while another day is clicked. Whatever was
  // being picked belonged to the day that just left.
  useEffect(() => {
    setPick(null)
    setGoingBack(false)
  }, [day])

  // Only the modal sheet freezes the page: the panel is meant to be used with
  // the week still scrolling beside it.
  useEffect(() => {
    if (!isSheet) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isSheet])

  // Returning the focus to the day card is the caller's job (§5): it is the one
  // that knows which card that is after the week has re-rendered around it.

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (addingDish) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // The panel is not modal (§0): Tab walks out of it into the week on
      // purpose, so only the sheet keeps the focus inside.
      if (e.key !== 'Tab' || !isSheet || !sheetRef.current) return

      const focusables = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), input:not([disabled])'
        )
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === first || !sheetRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSheet, addingDish, onClose])

  const itemOf = (mealType: MealType) => (mealType === 'lunch' ? lunch : dinner)

  const dishByName = new Map(dishIdeas.map(dish => [dish.name, dish]))
  const ingredientsOf = (name?: string): Ingredient[] =>
    (name ? dishByName.get(name)?.main_ingredients : undefined) ?? []

  /**
   * What the rules compare across meals: the main course of the other meal, the
   * same thing the generator reads. Feeding it the starter too would warn about
   * pairings the generator itself allows.
   */
  const mainCourseIngredientsOf = (item: MenuItem | null): Ingredient[] => {
    const courses = coursesOf(item)
    return ingredientsOf(courses[courses.length - 1]?.dish)
  }

  const openPicker = (target: PickTarget) => {
    setGoingBack(false)
    setPick(target)
  }

  const backToDay = () => {
    setGoingBack(true)
    setPick(null)
  }

  const commitPick = (dishName: string) => {
    if (!pick) return
    if (pick.mode === 'add') onAddFirstCourse(pick.mealType, dishName)
    else onReplaceCourse(pick.mealType, pick.slot, dishName)
    backToDay()
  }

  const stepClass = goingBack ? 'anim-step-back' : 'anim-step'

  const mealBlock = (mealType: MealType) => {
    const item = itemOf(mealType)
    const courses = coursesOf(item)
    const control = formatControlFor(item)
    const isLunch = mealType === 'lunch'

    return (
      <section className="mt-5 first:mt-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-tinta-500">
            <span aria-hidden="true">{isLunch ? '☀' : '☾'}</span> {MEAL_LABEL[mealType]}
            {courses.length > 0 && ` · ${courses.length === 1 ? 'un plato' : 'dos platos'}`}
          </h3>

          {control === 'add' && (
            <button
              type="button"
              onClick={() =>
                openPicker({ mealType, slot: 'starter', mode: 'add' })
              }
              aria-label={`Añadir un primer plato a la ${MEAL_LABEL[mealType].toLowerCase()} del ${dayTitle.toLowerCase()}`}
              className="relative flex-none rounded-full border-2 border-tinta-900 bg-crema-100 px-3.5 py-1.5 text-[13px] font-extrabold text-tinta-900 transition-colors duration-120 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:bg-crema-200 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
            >
              ＋ Primer plato
            </button>
          )}
          {control === 'remove' && (
            <button
              type="button"
              onClick={() => onRemoveFirstCourse(mealType)}
              aria-label={`Quitar el primer plato de la ${MEAL_LABEL[mealType].toLowerCase()} del ${dayTitle.toLowerCase()}`}
              className="relative flex-none rounded-full border-2 border-crema-300 bg-white px-3.5 py-1.5 text-[13px] font-extrabold text-tinta-900 transition-colors duration-120 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
            >
              − Quitar el primero
            </button>
          )}
        </div>

        {courses.length === 0 ? (
          <button
            type="button"
            onClick={() => openPicker({ mealType, slot: 'main', mode: 'replace' })}
            className={`mt-2 flex w-full min-h-[56px] items-center justify-between gap-3 rounded-[16px] border-2 border-dashed px-3.5 py-3 text-left transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 ${
              isLunch
                ? 'border-crema-300 bg-amarillo-100 hover:brightness-[0.98]'
                : 'border-verde-100 bg-verde-50 hover:brightness-[0.98]'
            }`}
          >
            <span className="text-[15px] font-extrabold text-tinta-500">Sin plato</span>
            <span
              className={`flex-none text-[15px] font-extrabold ${
                isLunch ? 'text-amarillo-700' : 'text-verde-700'
              }`}
            >
              Elegir ›
            </span>
          </button>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {courses.map(course => (
              <li key={course.slot}>
                <button
                  type="button"
                  onClick={() =>
                    openPicker({
                      mealType,
                      slot: course.slot,
                      mode: 'replace',
                      current: course.dish,
                    })
                  }
                  className={`flex w-full min-h-[56px] items-center justify-between gap-3 rounded-[16px] border-2 px-3.5 py-3 text-left transition-colors duration-120 hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-verde-500 ${
                    isLunch
                      ? 'border-crema-300 bg-amarillo-100'
                      : 'border-verde-100 bg-verde-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[17px] font-extrabold text-tinta-900">
                      {course.dish}
                    </span>
                    <span
                      className={`block text-[12.5px] font-bold font-sans ${
                        // verde-600 is 4.4:1 on verde-50, just under AA; verde-700
                        // is 5.4:1. The green rows are the only place it matters.
                        isLunch ? 'text-amarillo-700' : 'text-verde-700'
                      }`}
                    >
                      {course.role}
                    </span>
                  </span>
                  <span
                    className={`flex-none text-[15px] font-extrabold ${
                      isLunch ? 'text-amarillo-700' : 'text-verde-700'
                    }`}
                    aria-hidden="true"
                  >
                    Cambiar ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

      </section>
    )
  }

  const dayStep = (
    <div key="day" className={stepClass}>
      {mealBlock('lunch')}
      {mealBlock('dinner')}
      <p className="mt-5 rounded-[16px] border-2 border-dashed border-crema-300 px-3.5 py-3 text-[13px] font-bold font-sans leading-[1.45] text-tinta-500">
        Añadir o quitar el primero cambia <strong className="font-extrabold">sólo este día</strong>.
        Tus reglas de la casa siguen igual.
      </p>
    </div>
  )

  const pickStep = pick && (
    <div key={`pick-${pick.mealType}-${pick.slot}`} className={stepClass}>
      <DishPicker
        title={`${MEAL_LABEL[pick.mealType]} · ${slotWord(
          pick,
          coursesOf(itemOf(pick.mealType))
        )}`}
        subtitle={
          pick.mode === 'add'
            ? `${dayTitle} · elige un plato para empezar`
            : `${dayTitle} · ahora: ${pick.current}`
        }
        dishes={eligibleDishesFor(dishIdeas, pick.mealType, day)}
        currentDish={pick.current}
        warningFor={dish =>
          ruleWarningFor(dish, rules, {
            mealType: pick.mealType,
            otherMealIngredients: mainCourseIngredientsOf(
              itemOf(pick.mealType === 'lunch' ? 'dinner' : 'lunch')
            ),
            siblingCourseIngredients: ingredientsOf(
              coursesOf(itemOf(pick.mealType)).find(c => c.slot !== pick.slot)?.dish
            ),
          })
        }
        onPick={dish => commitPick(dish.name)}
        onBack={backToDay}
        onClose={isSheet ? onClose : undefined}
        onRequestNewDish={() => setAddingDish(true)}
      />
    </div>
  )

  const body = pick ? pickStep : dayStep

  const newDishModal = addingDish && pick && (
    <AddDishModal
      slot={pick.slot}
      mealType={pick.mealType}
      dishIdeas={dishIdeas}
      onClose={() => setAddingDish(false)}
      onConfirm={(name, _category, persist, dishData) => {
        // Same commit as picking from the list: one write, whether or not the
        // dish is also saved to the catalogue.
        commitPick(name)
        if (persist && dishData) onAddNewDish(dishData)
        setAddingDish(false)
      }}
    />
  )

  if (!isSheet) {
    return (
      <>
        <aside
          role="region"
          aria-label={`Editar el ${dayTitle.toLowerCase()}`}
          className="anim-pop sticky top-6 w-[430px] flex-none overflow-hidden rounded-[24px] border-[3px] border-tinta-900 bg-white shadow-pop"
        >
          <div className="flex items-center justify-between gap-3 bg-tinta-900 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-[19px] font-extrabold text-crema-100" aria-live="polite">
                {dayTitle}
              </p>
              <p className="text-xs font-bold font-sans text-crema-400">
                {pick ? 'Elige el plato que quieres poner' : 'Toca el plato que quieras cambiar'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 flex-none items-center rounded-full bg-verde-600 px-4 text-sm font-extrabold text-white transition-colors duration-120 hover:bg-verde-700 focus:outline-none focus:ring-2 focus:ring-amarillo-500 focus:ring-offset-2 focus:ring-offset-tinta-900"
            >
              {/* "Hecho", not the spec's "Listo": the sheet and the panel end
                  the same task, and two words for one action is one too many. */}
              ✓ Hecho
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden px-5 py-4">{body}</div>
        </aside>
        {newDishModal}
      </>
    )
  }

  return (
    <>
      <div
        className="anim-scrim fixed inset-0 z-30 flex items-end justify-center bg-[rgba(38,33,28,0.5)]"
        onClick={onClose}
      >
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Editar el ${dayTitle.toLowerCase()}`}
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
          // A fixed height so the two steps do not make the sheet jump (§0). The
          // picker is always the taller step, so this is its height.
          // Capped from 768px up: tablets keep the mobile container (§0), but a
          // sheet stretched to 900px turns every dish row into a lonely line.
          className="anim-sheet flex h-[82vh] w-full flex-col rounded-t-sheet border-t-[3px] border-tinta-900 bg-white px-[22px] pb-6 outline-none shadow-sheet md:max-w-[560px] md:rounded-t-[32px]"
        >
          {/* Dragging the sheet down closes it, from the handle and the title. */}
          <div
            onPointerDown={e => {
              dragStartY.current = e.clientY
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={e => {
              if (dragStartY.current === null) return
              setDragY(Math.max(0, e.clientY - dragStartY.current))
            }}
            onPointerUp={() => {
              dragStartY.current = null
              if (dragY > DRAG_CLOSE_THRESHOLD_PX) onClose()
              else setDragY(0)
            }}
            className="-mx-[22px] flex-none cursor-grab touch-none px-[22px] pb-2 pt-3"
          >
            <div className="mx-auto h-[5px] w-11 rounded-full bg-crema-300" aria-hidden="true" />
          </div>

          {!pick && (
            <div className="flex flex-none items-start justify-between gap-3 pb-1">
              <div className="min-w-0">
                <h2 className="text-[22px] font-extrabold leading-tight">{dayTitle}</h2>
                <p className="text-[13px] font-bold font-sans text-tinta-500">
                  Toca el plato que quieras cambiar.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-crema-100 text-lg font-extrabold text-tinta-900 transition-colors duration-120 hover:bg-crema-200 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* `overflow-x-hidden`: the step slides in from ±24px, and without it
              that shows up as a horizontal scrollbar for a quarter of a second. */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pt-1">{body}</div>

          {/* Finishing needs a button that says so. The ✕ closes the sheet, but
              "I am done with this day" is a decision, and the ✕ reads as
              "discard" — which is the wrong story here, where every change is
              already saved. Step 2 has no equivalent: there, choosing a dish is
              what ends the step, and ‹ goes back. */}
          {!pick && (
            <button type="button" onClick={onClose} className="btn-primary mt-3 w-full flex-none">
              ✓ Hecho
            </button>
          )}

          <div className="mt-3">
            <StepDots step={pick ? 2 : 1} />
          </div>
        </div>
      </div>
      {newDishModal}
    </>
  )
}

/** Two dots and a plain sentence, so "there is a step behind this" is legible. */
function StepDots({ step }: { step: 1 | 2 }): ReactNode {
  return (
    <div className="flex flex-none items-center justify-center gap-2 border-t-2 border-crema-200 pt-2.5">
      <span
        className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-tinta-900' : 'bg-crema-300'}`}
        aria-hidden="true"
      />
      <span
        className={`h-2 w-2 rounded-full ${step === 2 ? 'bg-tinta-900' : 'bg-crema-300'}`}
        aria-hidden="true"
      />
      <span className="text-xs font-bold font-sans text-tinta-500">
        {step === 1 ? 'Paso 1 de 2 · el día' : 'Paso 2 de 2 · vuelve con ‹'}
      </span>
    </div>
  )
}
