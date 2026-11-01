/**
 * The demo household the promo video is recorded with: the starter catalogue,
 * three dishes of the family's own with no ingredients yet, and a believable
 * menu for this week and the next. The starter ingredients are not here on
 * purpose: the app seeds them itself on first load, the same way it does for a
 * real household.
 */
import { STARTER_CATALOG } from '../../src/data/starterCatalog'
import { DishIdea, MenuItem, NewDishIdea } from '../../src/types'
import { generateWeeklyMenu } from '../../src/utils/menuGenerator'
import { parseRules } from '../../src/lib/householdRules'

export const HOUSEHOLD_ID = 'demo-household'
export const MEMBERS = {
  ana: { id: 'user-ana', email: 'ana@ejemplo.test' },
  pablo: { id: 'user-pablo', email: 'pablo@ejemplo.test' },
} as const

export const OWN_DISHES: NewDishIdea[] = [
  { name: 'Pollo al curry', category: 'main', meal_type: 'both', day_type: 'anyday', main_ingredients: ['meat', 'rice'] },
  { name: 'Quiche de puerros', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['vegetable', 'egg'] },
  { name: 'Tortilla de la abuela', category: 'main', meal_type: 'dinner', day_type: 'anyday', main_ingredients: ['egg', 'potato'] },
]

type Meal = Omit<MenuItem, 'day' | 'meal_type'>
const day = (iso: string, lunch: Meal, dinner: Meal): MenuItem[] => [
  { day: iso, meal_type: 'lunch', ...lunch },
  { day: iso, meal_type: 'dinner', ...dinner },
]

const THIS_WEEK: MenuItem[] = [
  ...day('2026-11-09', { starter: 'Crema de calabacín', main: 'Lomo a la plancha' }, { main: 'Tortilla francesa' }),
  ...day('2026-11-10', { starter: 'Ensalada mixta', main: 'Lentejas con verduras' }, { main: 'Pollo al curry' }),
  ...day('2026-11-11', { starter: 'Judías verdes con patata', main: 'Salmón a la plancha' }, { main: 'Quiche de puerros' }),
  ...day('2026-11-12', { single: 'Cocido' }, { starter: 'Crema de verduras', main: 'Tortilla de la abuela' }),
  ...day('2026-11-13', { starter: 'Ensalada de espinacas', main: 'Merluza a la romana' }, { main: 'Hamburguesa casera' }),
  ...day('2026-11-14', { single: 'Paella mixta' }, { main: 'Pizza casera' }),
  ...day('2026-11-15', { starter: 'Ensaladilla rusa', main: 'Pollo asado' }, { main: 'Revuelto de champiñones' }),
]

const stamp = '2026-11-06T18:00:00.000Z'

export function buildDemoDatabase(): Record<string, Record<string, unknown>[]> {
  const dishes: DishIdea[] = [...STARTER_CATALOG, ...OWN_DISHES].map((dish, index) => ({
    ...dish,
    id: `dish-${index}`,
    household_id: HOUSEHOLD_ID,
    recipe_url: null,
    created_at: stamp,
    updated_at: stamp,
  }))

  const nextWeek = generateWeeklyMenu({
    dishIdeas: dishes.filter((dish) => !OWN_DISHES.some((own) => own.name === dish.name)),
    weekStart: new Date(2026, 10, 16),
    rules: parseRules({}),
  }).items

  return {
    households: [
      {
        id: HOUSEHOLD_ID,
        name: 'Casa García',
        join_code: 'NAM-4821',
        rules: {},
        ingredients_seeded_at: null,
        shopping_guide_seen_at: null,
      },
    ],
    dish_ideas: dishes,
    ingredients: [],
    dish_ingredients: [],
    weekly_menus: [
      { id: 'menu-this', household_id: HOUSEHOLD_ID, week_start: '2026-11-09', week_end: '2026-11-15', menu_items: THIS_WEEK, created_at: stamp, updated_at: stamp },
      { id: 'menu-next', household_id: HOUSEHOLD_ID, week_start: '2026-11-16', week_end: '2026-11-22', menu_items: nextWeek, created_at: stamp, updated_at: stamp },
    ],
    shopping_lists: [],
    shopping_list_items: [],
    household_members: [],
    feedback: [],
  }
}
