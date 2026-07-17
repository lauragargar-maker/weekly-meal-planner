import { WeeklyMenu, DishIdea, NewDishIdea } from '../types'
import { formatDayName, formatDate } from '../utils/menuGenerator'
import DishEditor from './DishEditor'

interface MenuListViewProps {
  menu: WeeklyMenu
  dishIdeas: DishIdea[]
  onUpdateDish: (dayISO: string, mealType: 'lunch' | 'dinner', dishSlot: 'starter' | 'main' | 'single', newDishName: string, selectedCategory: 'starter' | 'main' | 'single') => void
  onAddNewDish: (dishData: NewDishIdea) => void
}

export default function MenuListView({ menu, dishIdeas, onUpdateDish, onAddNewDish }: MenuListViewProps) {
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

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-bold mb-4">
          Week of {formatDate(menu.week_start)} - {formatDate(menu.week_end)}
        </h2>

        <div className="space-y-6">
          {sortedDays.map((day) => {
            const { lunch, dinner } = itemsByDay[day]
            return (
              <div key={day} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {formatDayName(day)} - {formatDate(day)}
                </h3>

                <div className="space-y-4">
                  {lunch && (
                    <div>
                      <h4 className="font-medium text-primary-700 mb-2">🌅 Lunch</h4>
                      {lunch.single ? (
                        <p className="text-gray-700 ml-4"><DishEditor value={lunch.single} slot="single" mealType="lunch" day={day} dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'single', name, cat)} onAddNewDish={onAddNewDish} /></p>
                      ) : (
                        <ul className="ml-4 space-y-1 text-gray-700">
                          {lunch.starter && <li>Starter: <DishEditor value={lunch.starter} slot="starter" mealType="lunch" day={day} dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'starter', name, cat)} onAddNewDish={onAddNewDish} /></li>}
                          {lunch.main && <li>Main: <DishEditor value={lunch.main} slot="main" mealType="lunch" day={day} dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'lunch', 'main', name, cat)} onAddNewDish={onAddNewDish} /></li>}
                        </ul>
                      )}
                    </div>
                  )}

                  {dinner && (
                    <div>
                      <h4 className="font-medium text-primary-700 mb-2">🌙 Dinner</h4>
                      {dinner.main && (
                        <p className="text-gray-700 ml-4"><DishEditor value={dinner.main} slot="main" mealType="dinner" day={day} dishIdeas={dishIdeas} onUpdate={(name, cat) => onUpdateDish(day, 'dinner', 'main', name, cat)} onAddNewDish={onAddNewDish} /></p>
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
