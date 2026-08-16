import { ReactNode, useEffect, useRef, useState } from 'react'
import { WeeklyMenu, DishIdea, NewDishIdea } from '../types'
import { formatDayName } from '../utils/menuGenerator'
import { CourseSlot, MealType, coursesOf } from '../lib/dayFormat'
import { HouseholdRules } from '../lib/householdRules'
import { useMediaQuery } from '../lib/useMediaQuery'
import DayEditor from './DayEditor'

interface MenuAgendaViewProps {
  menu: WeeklyMenu
  dishIdeas: DishIdea[]
  rules: HouseholdRules
  /** Past weeks are history: shown, never edited. */
  readOnly: boolean
  onReplaceCourse: (dayISO: string, mealType: MealType, slot: CourseSlot, dishName: string) => void
  onAddFirstCourse: (dayISO: string, mealType: MealType, dishName: string) => void
  onRemoveFirstCourse: (dayISO: string, mealType: MealType) => void
  onAddNewDish: (dishData: NewDishIdea) => void
  /** For analytics: which day was opened, and in which container. */
  onOpenDay?: (dayISO: string, surface: 'sheet' | 'panel') => void
}

type MenuItem = WeeklyMenu['menu_items'][0]

const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

/** Above this the day opens in a panel beside the week; below it, in a sheet. */
const DESKTOP_QUERY = '(min-width: 1024px)'

/** Today as a local YYYY-MM-DD string, comparable with the ISO days in menu_items. */
const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dayNumber = (iso: string): string => String(new Date(iso).getDate())

const dayAbbr = (iso: string): string => DAY_ABBR[new Date(iso).getDay()]

/** Dish names of a meal, in course order. */
const dishesOf = (item: MenuItem | null): string[] =>
  coursesOf(item).map(course => course.dish)

/*
 * These five live at module scope on purpose. Declared inside the component,
 * each render would create a new component type, and React would throw away the
 * DOM node and build a new one — which silently breaks returning the focus to
 * the day card that opened the editor, because by then that node is detached.
 */

/** Coloured circle with the sun/moon glyph. */
const MealCircle = ({ mealType, size }: { mealType: MealType; size: number }) => (
  <span
    className={`flex flex-none items-center justify-center rounded-full ${
      mealType === 'lunch' ? 'bg-amarillo-500 text-tinta-900' : 'bg-verde-500 text-white'
    }`}
    style={{ width: size, height: size, fontSize: size * (mealType === 'lunch' ? 0.45 : 0.41) }}
    aria-hidden="true"
  >
    {mealType === 'lunch' ? '☀' : '☾'}
  </span>
)

/** Circle + COMIDA/CENA label + dish names. Used on prominent cards. */
const MealBlock = ({ item, mealType, circle, nameClass }: { item: MenuItem | null; mealType: MealType; circle: number; nameClass: string }) => {
  const dishes = dishesOf(item)
  if (dishes.length === 0) return null
  return (
    <div className="flex items-start gap-2.5">
      <MealCircle mealType={mealType} size={circle} />
      <div className="min-w-0">
        <p className="text-xs font-extrabold tracking-[0.08em] text-tinta-500">
          {mealType === 'lunch' ? 'COMIDA' : 'CENA'}
        </p>
        <div className="flex flex-col gap-1">
          {dishes.map((dish) => (
            <p key={dish} className={nameClass}>{dish}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

/** One line per meal, courses joined with "·". Used on secondary cards. */
const CompactMeals = ({ lunch, dinner }: { lunch: MenuItem | null; dinner: MenuItem | null }) => {
  const lunchDishes = dishesOf(lunch)
  const dinnerDishes = dishesOf(dinner)
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm font-bold font-sans leading-[1.3]">
      {/* The sun and the moon are the only thing telling lunch from dinner here,
          and they are decorative: now that the card is a button, its contents are
          read out, so the distinction has to exist in text too. */}
      {lunchDishes.length > 0 && (
        <p className="flex gap-2">
          <span className="flex-none text-amarillo-500" aria-hidden="true">☀</span>
          <span className="text-tinta-900">
            <span className="sr-only">Comida: </span>
            {lunchDishes.join(' · ')}
          </span>
        </p>
      )}
      {dinnerDishes.length > 0 && (
        <p className="flex gap-2">
          <span className="flex-none text-verde-500" aria-hidden="true">☾</span>
          <span className="text-tinta-500">
            <span className="sr-only">Cena: </span>
            {dinnerDishes.join(' · ')}
          </span>
        </p>
      )}
    </div>
  )
}

/**
 * The one edit affordance, on every day alike (§1). It is a signal, not the
 * target: the whole card is the button, which is what the two interviewees
 * tried to press in the first place.
 */
const Pencil = ({ strong }: { strong?: boolean }) => (
  <span
    aria-hidden="true"
    className={`flex h-11 w-11 flex-none items-center justify-center rounded-full bg-crema-100 text-[18px] font-extrabold text-tinta-900 ${
      strong ? 'border-2 border-tinta-900 shadow-[3px_3px_0_#f0e2c8]' : 'border-2 border-crema-300'
    }`}
  >
    ✎
  </span>
)

/**
 * A day card: a button when the week can be edited, a plain box when it is
 * history. Past weeks keep the layout and lose the affordance.
 */
const DayCard = ({
  day,
  className,
  canEdit,
  onOpen,
  children,
}: {
  day: string
  className: string
  canEdit: boolean
  onOpen: (day: string) => void
  children: ReactNode
}) =>
  canEdit ? (
    <button
      type="button"
      onClick={() => onOpen(day)}
      // Closing the editor gives the focus back through this attribute rather
      // than through the node: on desktop the week swaps layouts as it closes,
      // so the card that opened it no longer exists by then.
      data-day={day}
      aria-label={`Editar el menú del ${formatDayName(day).toLowerCase()} ${dayNumber(day)}`}
      className={`${className} w-full text-left transition-transform duration-120 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2`}
    >
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  )

export default function MenuAgendaView({
  menu,
  dishIdeas,
  rules,
  readOnly,
  onReplaceCourse,
  onAddFirstCourse,
  onRemoveFirstCourse,
  onAddNewDish,
  onOpenDay,
}: MenuAgendaViewProps) {
  const [openDay, setOpenDay] = useState<string | null>(null)
  // The day whose card should get the focus back, once the week has re-rendered.
  const [refocusDay, setRefocusDay] = useState<string | null>(null)
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const rootRef = useRef<HTMLDivElement>(null)

  // Group menu items by day
  const itemsByDay = menu.menu_items.reduce((acc, item) => {
    if (!acc[item.day]) {
      acc[item.day] = { lunch: null, dinner: null }
    }
    if (item.meal_type === 'lunch') {
      acc[item.day].lunch = item
    } else if (item.meal_type === 'dinner') {
      acc[item.day].dinner = item
    }
    return acc
  }, {} as Record<string, { lunch: MenuItem | null; dinner: MenuItem | null }>)

  // Sort days chronologically starting from week_start
  const sortedDays = Object.keys(itemsByDay).sort((a, b) => {
    const dateA = new Date(a).getTime()
    const dateB = new Date(b).getTime()
    return dateA - dateB
  })

  // Split days into two rows: 4 days in first row, 3 days in second row (desktop only)
  const firstRowDays = sortedDays.slice(0, 4)
  const secondRowDays = sortedDays.slice(4, 7)

  const today = todayISO()
  // No offset needed: only one week of the year contains today, whichever one
  // is on screen. Weeks entirely in the past or the future highlight nothing.
  const todayDay = sortedDays.find((d) => d === today)
  const otherDays = sortedDays.filter((d) => d !== todayDay)
  // Dimming days that have already happened only says something next to a day
  // that hasn't. A week wholly in the past is shown at full strength.
  const isPast = (day: string) => Boolean(todayDay) && day < today

  const canEdit = !readOnly

  // Navigating to another week unmounts nothing, so an open day would survive
  // into a week it does not belong to.
  useEffect(() => {
    setOpenDay(null)
  }, [menu.week_start])

  /**
   * §5: the focus comes back to the day card. It has to be found again after
   * the week has re-rendered — mobile and desktop both keep a card per day in
   * the DOM, and only one of the two is visible, so the hidden one would
   * swallow the focus.
   */
  useEffect(() => {
    if (!refocusDay) return
    const cards = rootRef.current?.querySelectorAll<HTMLElement>(`[data-day="${refocusDay}"]`)
    cards?.forEach(card => {
      if (card.offsetParent !== null) card.focus()
    })
    setRefocusDay(null)
  }, [refocusDay])

  const closeEditor = () => {
    setRefocusDay(openDay)
    setOpenDay(null)
  }

  const openEditor = (day: string) => {
    setOpenDay(day)
    onOpenDay?.(day, isDesktop ? 'panel' : 'sheet')
  }

  const separator = <div className="h-0.5 rounded bg-amarillo-300" />

  /** Highlighted card for today. */
  const renderTodayCard = (day: string, variant: 'mobile' | 'desktop') => {
    const { lunch, dinner } = itemsByDay[day]
    const desktop = variant === 'desktop'
    const nameClass = `font-extrabold leading-[1.25] ${desktop ? 'text-[21px]' : 'text-[19px]'}`
    return (
      <div className={`relative ${desktop ? 'h-full' : 'mt-1.5'}`}>
        <span
          className={`anim-badge absolute right-3.5 z-[2] rotate-[4deg] rounded-full bg-amarillo-500 px-3.5 py-1 font-extrabold text-tinta-900 shadow-badge ${
            desktop ? '-top-[13px] text-[15px]' : '-top-3 text-[13px]'
          }`}
        >
          {desktop ? 'HOY' : `HOY · ${formatDayName(day)}`}
        </span>
        <DayCard
          day={day}
          canEdit={canEdit}
          onOpen={openEditor}
          className={`h-full border-[3px] border-tinta-900 bg-white ${
            desktop ? 'rounded-[26px] p-6 shadow-[7px_7px_0_#f0e2c8]' : 'rounded-hoy p-[18px] shadow-pop'
          }`}
        >
          {desktop && (
            <h3 className="mb-4 text-[22px] font-extrabold text-rojo-500">
              {formatDayName(day)} {dayNumber(day)}
            </h3>
          )}
          {/* The pencil shares the row with the meals rather than sitting in its
              own line: it is what keeps the card of today short. */}
          <div className="flex items-center gap-3.5">
            <div className="min-w-0 flex-1">
              <MealBlock item={lunch} mealType="lunch" circle={44} nameClass={nameClass} />
              <div className={desktop ? 'my-[18px]' : 'my-3.5'}>{separator}</div>
              <MealBlock item={dinner} mealType="dinner" circle={44} nameClass={nameClass} />
            </div>
            {canEdit && <Pencil strong />}
          </div>
        </DayCard>
      </div>
    )
  }

  /** Mobile row for any day that is not today. */
  const renderCompactRow = (day: string) => {
    const { lunch, dinner } = itemsByDay[day]
    return (
      <DayCard
        key={day}
        day={day}
        canEdit={canEdit}
        onOpen={openEditor}
        className={`flex items-center gap-3 rounded-[18px] border-2 border-crema-300 bg-white py-3 px-3.5 active:border-[3px] active:border-tinta-900 ${
          isPast(day) ? 'opacity-[0.55]' : ''
        }`}
      >
        <div className="w-[46px] flex-none self-start rounded-xl bg-crema-200 py-1.5 text-center">
          <p className="text-xs font-extrabold text-tinta-500">{dayAbbr(day)}</p>
          <p className="text-base font-extrabold text-tinta-500">{dayNumber(day)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <CompactMeals lunch={lunch} dinner={dinner} />
        </div>
        {canEdit && <Pencil />}
      </DayCard>
    )
  }

  /** Desktop card in the 3×2 grid beside today. */
  const renderGridCard = (day: string) => {
    const { lunch, dinner } = itemsByDay[day]
    return (
      <DayCard
        key={day}
        day={day}
        canEdit={canEdit}
        onOpen={openEditor}
        className={`rounded-[20px] border-2 border-crema-300 bg-white p-4 hover:-translate-y-0.5 hover:shadow-pop ${
          isPast(day) ? 'opacity-[0.55]' : ''
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className="min-w-0 flex-1">
            <h3 className="mb-2 text-base font-extrabold">
              {formatDayName(day)} {dayNumber(day)}
            </h3>
            <CompactMeals lunch={lunch} dinner={dinner} />
          </div>
          {canEdit && <Pencil />}
        </div>
      </DayCard>
    )
  }

  /** Desktop card for next week, where no day stands out. */
  const renderUniformCard = (day: string) => {
    const { lunch, dinner } = itemsByDay[day]
    return (
      <DayCard
        key={day}
        day={day}
        canEdit={canEdit}
        onOpen={openEditor}
        className="rounded-card border-2 border-crema-300 bg-white p-5 hover:-translate-y-0.5 hover:shadow-pop"
      >
        <div className="flex items-center gap-3.5">
          <div className="min-w-0 flex-1">
            {/* One line, like every other card: the day name and its number are read
                as one label ("Lunes 10"), and splitting them across two block
                elements made next week look like a different screen from this one. */}
            <h3 className="text-xl font-extrabold">
              {formatDayName(day)} {dayNumber(day)}
            </h3>
            <div className="mt-3.5">
              <MealBlock item={lunch} mealType="lunch" circle={34} nameClass="text-base font-extrabold leading-[1.25]" />
            </div>
            <div className="my-3">{separator}</div>
            <MealBlock item={dinner} mealType="dinner" circle={34} nameClass="text-base font-extrabold leading-[1.25]" />
          </div>
          {canEdit && <Pencil />}
        </div>
      </DayCard>
    )
  }

  /**
   * Desktop, with a day open: seven equal cards in two columns beside the panel.
   * Today keeps its badge but loses the big card — the panel is the thing to
   * look at now, and the day being edited is the one that has to stand out.
   */
  const renderEditingCard = (day: string) => {
    const { lunch, dinner } = itemsByDay[day]
    const isOpen = day === openDay
    const isToday = day === todayDay
    return (
      <DayCard
        key={day}
        day={day}
        canEdit={canEdit}
        onOpen={openEditor}
        className={`rounded-[18px] p-3.5 ${
          isOpen
            ? 'border-[3px] border-tinta-900 bg-crema-100 shadow-pop-sm'
            : isToday
              ? 'border-2 border-amarillo-500 bg-white'
              : 'border-2 border-crema-300 bg-white'
        } ${isPast(day) && !isOpen ? 'opacity-[0.55]' : ''}`}
      >
        <h3 className="mb-1.5 flex items-center gap-2 text-[15px] font-extrabold">
          {formatDayName(day)} {dayNumber(day)}
          {isToday && (
            <span className="rounded-full bg-amarillo-500 px-2 py-0.5 text-[11px] font-extrabold text-tinta-900">
              HOY
            </span>
          )}
          {isOpen && (
            <span className="rounded-full bg-tinta-900 px-2 py-0.5 text-[11px] font-extrabold text-crema-100">
              EDITANDO
            </span>
          )}
        </h3>
        <CompactMeals lunch={lunch} dinner={dinner} />
      </DayCard>
    )
  }

  const dayEditor = (surface: 'sheet' | 'panel') =>
    openDay && (
      <DayEditor
        day={openDay}
        lunch={itemsByDay[openDay]?.lunch ?? null}
        dinner={itemsByDay[openDay]?.dinner ?? null}
        dishIdeas={dishIdeas}
        rules={rules}
        surface={surface}
        onClose={closeEditor}
        onReplaceCourse={(mealType, slot, dishName) =>
          onReplaceCourse(openDay, mealType, slot, dishName)
        }
        onAddFirstCourse={(mealType, dishName) => onAddFirstCourse(openDay, mealType, dishName)}
        onRemoveFirstCourse={(mealType) => onRemoveFirstCourse(openDay, mealType)}
        onAddNewDish={onAddNewDish}
      />
    )

  return (
    <div ref={rootRef}>
      {/* Mobile: today highlighted, every other day as a compact row */}
      <div className="mt-4 flex flex-col gap-2.5 lg:hidden">
        {sortedDays.map((day) =>
          day === todayDay ? (
            <div key={day}>{renderTodayCard(day, 'mobile')}</div>
          ) : (
            renderCompactRow(day)
          )
        )}
      </div>

      {/* Desktop: today on the left + 3×2 grid; uniform 4+3 when no day is today */}
      <div className="mt-6 hidden lg:block">
        {openDay && isDesktop ? (
          <div className="flex items-start gap-5">
            <div className="grid flex-1 grid-cols-2 gap-3.5">
              {sortedDays.map((day) => renderEditingCard(day))}
            </div>
            {dayEditor('panel')}
          </div>
        ) : todayDay ? (
          <div className="flex items-stretch gap-5">
            <div className="w-[340px] flex-none">{renderTodayCard(todayDay, 'desktop')}</div>
            <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-3.5">
              {otherDays.map((day) => renderGridCard(day))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-5">
              {firstRowDays.map((day) => renderUniformCard(day))}
            </div>
            <div className="mt-5 flex justify-center">
              <div className="grid w-3/4 grid-cols-3 gap-5">
                {secondRowDays.map((day) => renderUniformCard(day))}
              </div>
            </div>
          </>
        )}
      </div>

      {!isDesktop && dayEditor('sheet')}
    </div>
  )
}
