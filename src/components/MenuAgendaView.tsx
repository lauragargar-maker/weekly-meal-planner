import { WeeklyMenu, DishIdea } from '../types'
import { formatDayName, formatDate } from '../utils/menuGenerator'
import DishEditor from './DishEditor'

interface MenuAgendaViewProps {
  menu: WeeklyMenu
  dishIdeas: DishIdea[]
  onUpdateDish: (dayISO: string, mealType: 'lunch' | 'dinner', dishSlot: 'starter' | 'main' | 'single', newDishName: string, selectedCategory: 'starter' | 'main' | 'single') => void
  weekOffset: 0 | 1
  canAccessNextWeek: boolean
  onNavigate: (direction: -1 | 1) => void
}

export default function MenuAgendaView({ menu, dishIdeas, onUpdateDish, weekOffset, canAccessNextWeek, onNavigate }: MenuAgendaViewProps) {
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
  }, {} as Record<string, { lunch: typeof menu.menu_items[0] | null; dinner: typeof menu.menu_items[0] | null }>)

  // Sort days chronologically starting from week_start (Saturday)
  const sortedDays = Object.keys(itemsByDay).sort((a, b) => {
    const dateA = new Date(a).getTime()
    const dateB = new Date(b).getTime()
    // Sort by date value (chronological order) - Saturday should be first
    return dateA - dateB
  })

  // Split days into two rows: 4 days in first row, 3 days in second row (desktop only)
  const firstRowDays = sortedDays.slice(0, 4)
  const secondRowDays = sortedDays.slice(4, 7)

  const renderLunch = (day: string, lunch: typeof menu.menu_items[0]) => (
    <div className="bg-white rounded p-4 border-l-4 border-primary-500">
      <h4 className="text-lg font-semibold text-primary-700 mb-2">🌅 Lunch</h4>
      {lunch.single ? (
        <p className="text-lg text-gray-700"><DishEditor value={lunch.single} slot="single" mealType="lunch" dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'single', name, cat)} /></p>
      ) : (
        <ul className="text-lg text-gray-700 space-y-2">
          {lunch.starter && <li><DishEditor value={lunch.starter} slot="starter" mealType="lunch" dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'starter', name, cat)} /></li>}
          {lunch.main && <li><DishEditor value={lunch.main} slot="main" mealType="lunch" dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'main', name, cat)} /></li>}
        </ul>
      )}
    </div>
  )

  const renderDinner = (day: string, dinner: typeof menu.menu_items[0]) => (
    <div className="bg-white rounded p-4 border-l-4 border-primary-600">
      <h4 className="text-lg font-semibold text-primary-700 mb-2">🌙 Dinner</h4>
      {dinner.main && (
        <p className="text-lg text-gray-700"><DishEditor value={dinner.main} slot="main" mealType="dinner" dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'dinner', 'main', name, cat)} /></p>
      )}
    </div>
  )

  const renderDayCard = (day: string, className: string) => {
    const { lunch, dinner } = itemsByDay[day]
    return (
      <div key={day} className={className}>
        <div className="mb-4">
          <h3 className="text-2xl font-bold text-gray-900">
            {formatDayName(day)}
          </h3>
          <p className="text-lg text-gray-600 mt-1">{formatDate(day)}</p>
        </div>

        <div className="space-y-4">
          {lunch && renderLunch(day, lunch)}
          {dinner && renderDinner(day, dinner)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => onNavigate(-1)}
            disabled={weekOffset === 0}
            className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Go to current week"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-sm font-medium text-primary-600 mb-1">
              {weekOffset === 0 ? 'Current Week' : 'Next Week'}
            </div>
            <h2 className="text-3xl font-bold">
              {formatDate(menu.week_start)} – {formatDate(menu.week_end)}
            </h2>
          </div>

          <button
            onClick={() => onNavigate(1)}
            disabled={weekOffset === 1 || !canAccessNextWeek}
            className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Go to next week"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Desktop layout: 4 days in first row, 3 days in second row */}
        <div className="hidden lg:block space-y-6">
          {/* First row: 4 days */}
          <div className="grid grid-cols-4 gap-6">
            {firstRowDays.map((day) =>
              renderDayCard(day, "bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow")
            )}
          </div>

          {/* Second row: 3 days - centered */}
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-6 w-3/4">
              {secondRowDays.map((day) =>
                renderDayCard(day, "bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow")
              )}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet layout: responsive grid */}
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedDays.map((day) => {
            const { lunch, dinner } = itemsByDay[day]
            return (
              <div
                key={day}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="mb-3">
                  <h3 className="text-xl font-bold text-gray-900">
                    {formatDayName(day)}
                  </h3>
                  <p className="text-base text-gray-600">{formatDate(day)}</p>
                </div>

                <div className="space-y-3">
                  {lunch && (
                    <div className="bg-white rounded p-3 border-l-4 border-primary-500">
                      <h4 className="text-base font-semibold text-primary-700 mb-1">🌅 Lunch</h4>
                      {lunch.single ? (
                        <p className="text-base text-gray-700"><DishEditor value={lunch.single} slot="single" mealType="lunch" dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'single', name, cat)} /></p>
                      ) : (
                        <ul className="text-base text-gray-700 space-y-1">
                          {lunch.starter && <li><DishEditor value={lunch.starter} slot="starter" mealType="lunch" dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'starter', name, cat)} /></li>}
                          {lunch.main && <li><DishEditor value={lunch.main} slot="main" mealType="lunch" dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'main', name, cat)} /></li>}
                        </ul>
                      )}
                    </div>
                  )}

                  {dinner && (
                    <div className="bg-white rounded p-3 border-l-4 border-primary-600">
                      <h4 className="text-base font-semibold text-primary-700 mb-1">🌙 Dinner</h4>
                      {dinner.main && (
                        <p className="text-base text-gray-700"><DishEditor value={dinner.main} slot="main" mealType="dinner" dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'dinner', 'main', name, cat)} /></p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
