import { WeeklyMenu, DishIdea, NewDishIdea } from '../types'
import { formatDayName } from '../utils/menuGenerator'
import { formatWeekRange } from '../utils/weekStart'
import DishEditor from './DishEditor'

interface MenuAgendaViewProps {
  menu: WeeklyMenu
  dishIdeas: DishIdea[]
  onUpdateDish: (dayISO: string, mealType: 'lunch' | 'dinner', dishSlot: 'starter' | 'main' | 'single', newDishName: string, selectedCategory: 'starter' | 'main' | 'single') => void
  onAddNewDish: (dishData: NewDishIdea) => void
  /** Past weeks are history: shown, never edited. */
  readOnly: boolean
  isEditing: boolean
  onToggleEditing: (editing: boolean) => void
}

type MenuItem = WeeklyMenu['menu_items'][0]

const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

/** Today as a local YYYY-MM-DD string, comparable with the ISO days in menu_items. */
const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dayNumber = (iso: string): string => String(new Date(iso).getDate())

const dayAbbr = (iso: string): string => DAY_ABBR[new Date(iso).getDay()]

/** Dish names of a meal, in course order. */
const dishesOf = (item: MenuItem | null): string[] => {
  if (!item) return []
  if (item.single) return [item.single]
  return [item.starter, item.main].filter((d): d is string => Boolean(d))
}

export default function MenuAgendaView({ menu, dishIdeas, onUpdateDish, onAddNewDish, readOnly, isEditing, onToggleEditing }: MenuAgendaViewProps) {
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

  /** Coloured circle with the sun/moon glyph. */
  const MealCircle = ({ mealType, size }: { mealType: 'lunch' | 'dinner'; size: number }) => (
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
  const MealBlock = ({ item, mealType, circle, nameClass }: { item: MenuItem | null; mealType: 'lunch' | 'dinner'; circle: number; nameClass: string }) => {
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
        {lunchDishes.length > 0 && (
          <p className="flex gap-2">
            <span className="flex-none text-amarillo-500" aria-hidden="true">☀</span>
            <span className="text-tinta-900">{lunchDishes.join(' · ')}</span>
          </p>
        )}
        {dinnerDishes.length > 0 && (
          <p className="flex gap-2">
            <span className="flex-none text-verde-500" aria-hidden="true">☾</span>
            <span className="text-tinta-500">{dinnerDishes.join(' · ')}</span>
          </p>
        )}
      </div>
    )
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
        <div
          className={`h-full border-[3px] border-tinta-900 bg-white ${
            desktop ? 'rounded-[26px] p-6 shadow-[7px_7px_0_#f0e2c8]' : 'rounded-hoy p-[18px] shadow-pop'
          }`}
        >
          {desktop && (
            <h3 className="mb-4 text-[22px] font-extrabold text-rojo-500">
              {formatDayName(day)} {dayNumber(day)}
            </h3>
          )}
          <MealBlock item={lunch} mealType="lunch" circle={44} nameClass={nameClass} />
          <div className={desktop ? 'my-[18px]' : 'my-3.5'}>{separator}</div>
          <MealBlock item={dinner} mealType="dinner" circle={44} nameClass={nameClass} />
        </div>
      </div>
    )
  }

  /** Mobile row for any day that is not today. */
  const renderCompactRow = (day: string) => {
    const { lunch, dinner } = itemsByDay[day]
    return (
      <div
        key={day}
        className={`flex gap-3 rounded-[18px] border-2 border-crema-300 bg-white py-3 px-3.5 ${
          isPast(day) ? 'opacity-[0.55]' : ''
        }`}
      >
        <div className="w-[46px] flex-none self-start rounded-xl bg-crema-200 py-1.5 text-center">
          <p className="text-xs font-extrabold text-tinta-500">{dayAbbr(day)}</p>
          <p className="text-base font-extrabold text-tinta-500">{dayNumber(day)}</p>
        </div>
        <CompactMeals lunch={lunch} dinner={dinner} />
      </div>
    )
  }

  /** Desktop card in the 3×2 grid beside today. */
  const renderGridCard = (day: string) => {
    const { lunch, dinner } = itemsByDay[day]
    return (
      <div
        key={day}
        className={`rounded-[20px] border-2 border-crema-300 bg-white p-4 transition-transform duration-180 hover:-translate-y-0.5 hover:shadow-pop ${
          isPast(day) ? 'opacity-[0.55]' : ''
        }`}
      >
        <h3 className="mb-2 text-base font-extrabold">
          {formatDayName(day)} {dayNumber(day)}
        </h3>
        <CompactMeals lunch={lunch} dinner={dinner} />
      </div>
    )
  }

  /** Desktop card for next week, where no day stands out. */
  const renderUniformCard = (day: string) => {
    const { lunch, dinner } = itemsByDay[day]
    return (
      <div
        key={day}
        className="rounded-card border-2 border-crema-300 bg-white p-5 transition-transform duration-180 hover:-translate-y-0.5 hover:shadow-pop"
      >
        {/* One line, like every other card: the day name and its number are read
            as one label ("Sábado 8"), and splitting them across two block
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
    )
  }

  /** Dashed card with one tappable row per dish. */
  const renderEditCard = (day: string) => {
    const { lunch, dinner } = itemsByDay[day]
    const isToday = day === todayDay
    return (
      <div key={day} className="card-edit lg:rounded-card">
        <h3 className={`mb-2 text-[15px] font-extrabold lg:text-[17px] ${isToday ? 'text-rojo-500' : ''}`}>
          {formatDayName(day)}
          {isToday ? ' · HOY' : ''}
        </h3>
        <div className="flex flex-col gap-1.5">
          {lunch?.single && (
            <DishEditor value={lunch.single} slot="single" mealType="lunch" day={day} dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'single', name, cat)} onAddNewDish={onAddNewDish} />
          )}
          {lunch?.starter && (
            <DishEditor value={lunch.starter} slot="starter" mealType="lunch" day={day} dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'starter', name, cat)} onAddNewDish={onAddNewDish} />
          )}
          {lunch?.main && (
            <DishEditor value={lunch.main} slot="main" mealType="lunch" day={day} dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'main', name, cat)} onAddNewDish={onAddNewDish} />
          )}
          {dinner?.main && (
            <DishEditor value={dinner.main} slot="main" mealType="dinner" day={day} dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'dinner', 'main', name, cat)} onAddNewDish={onAddNewDish} />
          )}
        </div>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div>
        <div className="anim-banner sticky top-0 z-10 flex items-center justify-between gap-3 rounded-[20px] bg-tinta-900 py-3 px-[18px] text-crema-100 lg:py-4 lg:px-6">
          <div className="min-w-0">
            <p className="text-base font-extrabold lg:text-[19px]">
              ✎ Estás editando la semana del {formatWeekRange(menu.week_start, menu.week_end)}
            </p>
            <p className="text-xs font-bold font-sans text-crema-400 lg:text-sm">
              Toca un plato para cambiarlo. Los cambios se guardan solos.
            </p>
          </div>
          <button
            onClick={() => onToggleEditing(false)}
            className="flex-none rounded-full bg-verde-600 px-4 py-2 text-sm font-extrabold text-white transition-colors duration-120 hover:bg-verde-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amarillo-500 focus:ring-offset-2 focus:ring-offset-tinta-900 lg:px-[22px] lg:py-2.5 lg:text-[15px]"
          >
            ✓ Hecho
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 lg:hidden">
          {sortedDays.map((day) => renderEditCard(day))}
        </div>

        <div className="mt-5 hidden lg:block">
          <div className="grid grid-cols-4 gap-5">
            {firstRowDays.map((day) => renderEditCard(day))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-5">
            {secondRowDays.map((day) => renderEditCard(day))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
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
        {todayDay ? (
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

      {!readOnly && (
        <button onClick={() => onToggleEditing(true)} className="btn-dark mt-4 w-full lg:hidden">
          ✎ Editar la semana
        </button>
      )}
    </div>
  )
}
