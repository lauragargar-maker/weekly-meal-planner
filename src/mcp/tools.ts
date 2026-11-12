import type { DishIdea, Ingredient, MenuItem, WeeklyMenu } from '../types'
import {
  addFirstCourse,
  coursesOf,
  removeFirstCourse,
  replaceCourse,
  ruleWarningFor,
  type CourseSlot,
  type MealType,
} from '../lib/dayFormat'
import { describeDegradedMenu } from '../lib/degradedMenu'
import { parseRules, requiresVegetableAtDinner, type HouseholdRules } from '../lib/householdRules'
import { formatIngredients, ingredientLabel } from '../lib/ingredients'
import { toKey } from '../lib/nameKey'
import { formatRange, groupBySection, listStatus, longDay, parseDay } from '../lib/shoppingList'
import { swapDays } from '../lib/swapDays'
import { generateWeeklyMenu } from '../utils/menuGenerator'
import { formatLocalDate, getCurrentWeekStart, weekEndFor, weekStartFor } from '../utils/weekStart'
import type { Store } from './store'

/**
 * The tools ¡Ñam! offers to an AI assistant, and what each one does.
 *
 * Nothing here decides how a menu works: the transforms, the rule warnings and
 * the generator are the same modules the app calls (`lib/dayFormat`,
 * `lib/swapDays`, `utils/menuGenerator`). What lives here is the translation
 * between an assistant's arguments and those functions, and the sentences that
 * go back. Results are written for a model to read to a person, in Spanish,
 * and always carry the ISO date of each day so the next call can name it.
 */

export interface ToolContext {
  store: Store
  /** The household's "today" — see `time.ts`. */
  today: Date
}

export interface ToolResult {
  text: string
  isError?: boolean
}

export interface Tool {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  /** Changes nothing: clients may run it without asking. */
  readOnly: boolean
  /** Can throw away work that cannot be brought back. */
  destructive?: boolean
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>
}

/** Something the assistant got wrong and can fix by calling again. */
class ToolError extends Error {}

function fail(message: string): never {
  throw new ToolError(message)
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const WEEKS = { anterior: -1, actual: 0, siguiente: 1 } as const
type WeekName = keyof typeof WEEKS

const MEALS: Record<string, MealType> = { comida: 'lunch', cena: 'dinner' }
const MEAL_LABEL: Record<MealType, string> = { lunch: 'Comida', dinner: 'Cena' }

const weekArg = (args: Record<string, unknown>, allowed: WeekName[]): WeekName => {
  const value = args.semana ?? 'actual'
  if (typeof value !== 'string' || !allowed.includes(value as WeekName)) {
    fail(`"semana" tiene que ser ${allowed.map(w => `"${w}"`).join(' o ')}.`)
  }
  return value as WeekName
}

const dayArg = (args: Record<string, unknown>, name: string): string => {
  const value = args[name]
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fail(`"${name}" tiene que ser una fecha AAAA-MM-DD, por ejemplo la que devuelve ver_menu.`)
  }
  // 2026-02-31 passes the pattern and silently becomes March.
  if (formatLocalDate(parseDay(value)) !== value) return fail(`"${value}" no es una fecha válida.`)
  return value
}

const mealArg = (args: Record<string, unknown>): MealType => {
  const meal = typeof args.comida === 'string' ? MEALS[args.comida] : undefined
  return meal ?? fail('"comida" tiene que ser "comida" (mediodía) o "cena".')
}

const textArg = (args: Record<string, unknown>, name: string): string => {
  const value = args[name]
  if (typeof value !== 'string' || !value.trim()) return fail(`Falta "${name}".`)
  return value.trim()
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

const weekKey = (name: WeekName, today: Date): string => formatLocalDate(weekStartFor(WEEKS[name], today))

/**
 * The week a day belongs to, when that week can still be edited.
 *
 * Same reach as the app: this week and the next one. The week before is
 * history, and anything further out has no menu to edit.
 */
const editableWeekOf = (day: string, today: Date): string => {
  const key = formatLocalDate(getCurrentWeekStart(parseDay(day)))
  if (key === weekKey('actual', today) || key === weekKey('siguiente', today)) return key
  return fail(
    key < weekKey('actual', today)
      ? `El ${longDay(day).toLowerCase()} es de una semana pasada, y las semanas pasadas no se cambian.`
      : `El ${day} queda más allá de la semana que viene; solo se planifican esta semana y la siguiente.`
  )
}

const daysOfWeek = (weekStart: string): string[] => {
  const monday = parseDay(weekStart)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return formatLocalDate(day)
  })
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const longDate = (day: string): string => `${longDay(day)} de ${MONTHS[parseDay(day).getMonth()]}`

const itemOf = (items: MenuItem[], day: string, meal: MealType): MenuItem | null =>
  items.find(item => item.day === day && item.meal_type === meal) ?? null

const formatMeal = (item: MenuItem | null): string => {
  const courses = coursesOf(item)
  if (courses.length === 0) return 'sin plato'
  if (courses.length === 1) return courses[0].dish
  return courses.map(course => `${course.dish} (${course.role.toLowerCase()})`).join(' + ')
}

const formatMenu = (menu: WeeklyMenu, today: Date): string => {
  const todayKey = formatLocalDate(today)
  const lines = daysOfWeek(menu.week_start).map(day => {
    const mark = day === todayKey ? ' — HOY' : ''
    return (
      `${longDate(day)} (${day})${mark}\n` +
      `  Comida: ${formatMeal(itemOf(menu.menu_items, day, 'lunch'))}\n` +
      `  Cena: ${formatMeal(itemOf(menu.menu_items, day, 'dinner'))}`
    )
  })
  return [`Menú de la semana del ${longDate(menu.week_start).toLowerCase()}:`, ...lines].join('\n\n')
}

const formatDay = (items: MenuItem[], day: string): string =>
  `${longDate(day)} (${day}): comida — ${formatMeal(itemOf(items, day, 'lunch'))}; ` +
  `cena — ${formatMeal(itemOf(items, day, 'dinner'))}.`

const CATEGORY_LABEL: Record<DishIdea['category'], string> = {
  starter: 'primero',
  main: 'segundo',
  single: 'plato único',
}
const MEAL_TYPE_LABEL: Record<DishIdea['meal_type'], string> = {
  lunch: 'comida',
  dinner: 'cena',
  both: 'comida o cena',
}
const DAY_TYPE_LABEL: Record<DishIdea['day_type'], string> = {
  weekday: 'entre semana',
  weekendday: 'fin de semana',
  anyday: 'cualquier día',
}

const formatDish = (dish: DishIdea): string => {
  const ingredients = formatIngredients(dish.main_ingredients ?? [])
  return (
    `- ${dish.name} · ${CATEGORY_LABEL[dish.category]} · ${MEAL_TYPE_LABEL[dish.meal_type]} · ` +
    `${DAY_TYPE_LABEL[dish.day_type]}${ingredients ? ` · ${ingredients}` : ''}`
  )
}

const formatRules = (rules: HouseholdRules): string => {
  const lunch = {
    single: 'un plato único',
    courses: 'primero y segundo',
    either: 'plato único o primero y segundo, indistintamente',
  }[rules.lunchStructure]
  const lines = [
    `- En la comida: ${lunch}.`,
    `- En la cena: ${rules.dinnerCourses === 2 ? 'dos platos' : 'un plato'}.`,
    `- ${rules.noRepeatCarb ? 'No se repite' : 'Se puede repetir'} el hidrato (pasta, arroz, patata) entre comida y cena.`,
    `- ${rules.noRepeatProtein ? 'No se repite' : 'Se puede repetir'} la proteína (carne, pescado, huevo, legumbre, lácteos) entre comida y cena.`,
    `- Pescado al menos ${rules.fishMinDays} días por semana.`,
    `- Legumbre en al menos ${rules.legumeMinLunches} comidas por semana.`,
    `- Pasta como mucho ${rules.pastaMaxPerWeek} veces por semana.`,
  ]
  if (requiresVegetableAtDinner(rules)) lines.push('- Verdura en todas las cenas.')
  if (rules.dinnerExclusions.length > 0) {
    lines.push(
      `- En la cena, nada de: ${rules.dinnerExclusions.map(i => ingredientLabel(i).toLowerCase()).join(', ')}.`
    )
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Dishes
// ---------------------------------------------------------------------------

/**
 * The household's dish with that name, or an error that lists the closest ones.
 *
 * Only dishes of the catalogue go on the menu from here. The app can also save
 * a brand new dish while editing a day, but that asks for its food groups and
 * shopping ingredients, and an assistant guessing those would quietly blind the
 * rules and the shopping list to it.
 */
const findDish = (dishes: DishIdea[], name: string): DishIdea => {
  const key = toKey(name)
  const exact = dishes.find(dish => toKey(dish.name) === key)
  if (exact) return exact

  const words = key.split(' ').filter(word => word.length > 2)
  const close = dishes
    .map(dish => {
      const dishKey = toKey(dish.name)
      const score =
        (dishKey.includes(key) || key.includes(dishKey) ? 10 : 0) +
        words.filter(word => dishKey.includes(word)).length
      return { dish, score }
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return fail(
    `"${name}" no está entre los platos de la casa. ` +
      (close.length > 0
        ? `Los más parecidos:\n${close.map(c => formatDish(c.dish)).join('\n')}\n` +
          'Repite la llamada con el nombre exacto de uno de ellos.'
        : 'Usa listar_platos para ver los que hay. Los platos nuevos se añaden desde la app.')
  )
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Reads the week, changes it and saves it, again if someone else saved first.
 *
 * The app keeps a week on screen and overwrites the whole of it on every edit.
 * From here the read and the write are milliseconds apart, but a family member
 * with the app open is exactly who else would be editing, so a save that finds
 * the week changed starts over from the fresh copy instead of flattening it.
 */
const editWeek = async (
  ctx: ToolContext,
  weekStart: string,
  change: (menu: WeeklyMenu) => MenuItem[]
): Promise<WeeklyMenu> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const menu =
      (await ctx.store.menu(weekStart)) ??
      fail('Esa semana todavía no tiene menú. Créalo antes con generar_menu.')
    const saved = await ctx.store.saveItems(menu, change(menu))
    if (saved) return saved
  }
  return fail('Alguien está cambiando el menú ahora mismo desde la app. Vuelve a intentarlo.')
}

/** Rewrites one meal; a degraded week can lack the row, and then it is added. */
const withMeal = (
  items: MenuItem[],
  day: string,
  meal: MealType,
  transform: (item: MenuItem) => MenuItem
): MenuItem[] => {
  const matches = (item: MenuItem) => item.day === day && item.meal_type === meal
  return items.some(matches)
    ? items.map(item => (matches(item) ? transform(item) : item))
    : [...items, transform({ day, meal_type: meal })].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

const warningFor = (
  dish: DishIdea,
  dishes: DishIdea[],
  rules: HouseholdRules,
  items: MenuItem[],
  day: string,
  meal: MealType,
  slot: CourseSlot
): string => {
  const ingredientsOf = (name?: string): Ingredient[] =>
    (name ? dishes.find(d => d.name === name)?.main_ingredients : undefined) ?? []
  const other = coursesOf(itemOf(items, day, meal === 'lunch' ? 'dinner' : 'lunch'))
  const warning = ruleWarningFor(dish, rules, {
    mealType: meal,
    // The other meal's main course only, as in the app's picker and the generator.
    otherMealIngredients: ingredientsOf(other[other.length - 1]?.dish),
    siblingCourseIngredients: ingredientsOf(
      coursesOf(itemOf(items, day, meal)).find(course => course.slot !== slot)?.dish
    ),
  })
  return warning
    ? `\nAviso: este plato no cumple una regla de la casa (${warning}). El cambio está hecho igualmente; ` +
        'díselo a la persona por si prefiere otro plato.'
    : ''
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const DAY_SCHEMA = { type: 'string', description: 'Fecha del día, AAAA-MM-DD.' }
const MEAL_SCHEMA = {
  type: 'string',
  enum: ['comida', 'cena'],
  description: '"comida" es la del mediodía; "cena", la de la noche.',
}

export const TOOLS: Tool[] = [
  {
    name: 'ver_menu',
    title: 'Ver el menú',
    description:
      'Devuelve el menú semanal de la casa (comida y cena de lunes a domingo) con la fecha de cada día. ' +
      'Úsalo para saber qué hay de comer o cenar un día, y antes de cambiar nada.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        semana: {
          type: 'string',
          enum: ['anterior', 'actual', 'siguiente'],
          description: 'Qué semana. Por defecto, la actual.',
        },
      },
    },
    async run(args, ctx) {
      const week = weekArg(args, ['anterior', 'actual', 'siguiente'])
      const menu = await ctx.store.menu(weekKey(week, ctx.today))
      const header = `Hoy es ${longDate(formatLocalDate(ctx.today)).toLowerCase()}.`
      if (!menu) {
        return {
          text:
            `${header} La semana ${week} no tiene menú` +
            (week === 'anterior' ? ': no se planificó.' : '. Se puede crear con generar_menu.'),
        }
      }
      return { text: `${header}\n\n${formatMenu(menu, ctx.today)}` }
    },
  },
  {
    name: 'listar_platos',
    title: 'Ver los platos de la casa',
    description:
      'Lista los platos del catálogo de la casa, que son los que se pueden poner en el menú. ' +
      'Cada uno indica si es primero, segundo o plato único, para qué comida sirve y sus grupos de alimento.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Texto que debe aparecer en el nombre.' },
        tipo: { type: 'string', enum: ['primero', 'segundo', 'unico'], description: 'Solo los de ese tipo.' },
        comida: { ...MEAL_SCHEMA, description: 'Solo los que sirven para esa comida.' },
      },
    },
    async run(args, ctx) {
      const search = typeof args.buscar === 'string' ? toKey(args.buscar) : ''
      const category = { primero: 'starter', segundo: 'main', unico: 'single' }[String(args.tipo ?? '')]
      const meal = typeof args.comida === 'string' ? MEALS[args.comida] : undefined
      const all = await ctx.store.dishes()
      const dishes = all.filter(
        dish =>
          (!search || toKey(dish.name).includes(search)) &&
          (!category || dish.category === category) &&
          (!meal || dish.meal_type === meal || dish.meal_type === 'both')
      )
      if (dishes.length === 0) {
        return {
          text: all.length === 0 ? 'La casa todavía no tiene platos.' : 'Ningún plato coincide con ese filtro.',
        }
      }
      return { text: `${dishes.length} platos:\n${dishes.map(formatDish).join('\n')}` }
    },
  },
  {
    name: 'ver_reglas',
    title: 'Ver las reglas de la casa',
    description:
      'Devuelve las reglas con las que la casa quiere sus menús (cuántos platos por comida, qué no se repite, ' +
      'mínimos y máximos semanales). Sirven para elegir bien al cambiar un plato. Se cambian desde la app.',
    readOnly: true,
    inputSchema: { type: 'object', properties: {} },
    async run(_args, ctx) {
      const household = await ctx.store.household()
      return { text: `Reglas de ${household.name}:\n${formatRules(parseRules(household.rules))}` }
    },
  },
  {
    name: 'ver_lista_compra',
    title: 'Ver la lista de la compra',
    description:
      'Devuelve la lista de la compra de la casa: lo que falta por comprar, agrupado por sección del ' +
      'supermercado, y cuánto está ya comprado. La lista se crea y se marca desde la app.',
    readOnly: true,
    inputSchema: { type: 'object', properties: {} },
    async run(_args, ctx) {
      const current = await ctx.store.shoppingList()
      if (!current) return { text: 'La casa no tiene lista de la compra. Se crea desde la app, a partir del menú.' }
      const { list, items } = current
      const status = listStatus(list, items, ctx.today)
      const pending = items.filter(item => !item.checked)
      const lines = [`Lista de la compra para ${formatRange(list.days)}.`]
      if (status === 'expired') lines.push('Es de días que ya han pasado: conviene hacer una nueva desde la app.')
      if (pending.length === 0) {
        lines.push(items.length === 0 ? 'Está vacía.' : `Está todo comprado (${items.length} productos).`)
      } else {
        lines.push(`Faltan ${pending.length} de ${items.length} productos:`)
        for (const group of groupBySection(pending)) {
          lines.push(`\n${group.label}\n${group.items.map(item => `- ${item.name}`).join('\n')}`)
        }
      }
      if (list.missing_dishes.length > 0) {
        lines.push(
          `\nNo incluye lo necesario para: ${list.missing_dishes.join(', ')} (esos platos no tienen ingredientes apuntados).`
        )
      }
      return { text: lines.join('\n') }
    },
  },
  {
    name: 'cambiar_plato',
    title: 'Cambiar un plato del menú',
    description:
      'Sustituye un plato del menú por otro del catálogo de la casa, en un día y una comida concretos. ' +
      'No cambia cuántos platos tiene esa comida. Si la comida tiene primero y segundo, hay que decir cuál.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: {
        dia: DAY_SCHEMA,
        comida: MEAL_SCHEMA,
        plato: { type: 'string', description: 'Nombre del plato nuevo, tal como sale en listar_platos.' },
        posicion: {
          type: 'string',
          enum: ['primero', 'segundo'],
          description: 'Solo si esa comida tiene dos platos: cuál de los dos se sustituye.',
        },
      },
      required: ['dia', 'comida', 'plato'],
    },
    async run(args, ctx) {
      const day = dayArg(args, 'dia')
      const meal = mealArg(args)
      const weekStart = editableWeekOf(day, ctx.today)
      const [dishes, household] = await Promise.all([ctx.store.dishes(), ctx.store.household()])
      const dish = findDish(dishes, textArg(args, 'plato'))

      let slot: CourseSlot = 'main'
      let before: MenuItem[] = []
      const saved = await editWeek(ctx, weekStart, menu => {
        before = menu.menu_items
        const courses = coursesOf(itemOf(menu.menu_items, day, meal))
        if (courses.length === 2) {
          if (args.posicion !== 'primero' && args.posicion !== 'segundo') {
            fail(
              `Esa ${MEAL_LABEL[meal].toLowerCase()} tiene dos platos: ${courses[0].dish} (primero) y ` +
                `${courses[1].dish} (segundo). Indica en "posicion" cuál se cambia.`
            )
          }
          slot = args.posicion === 'primero' ? 'starter' : 'main'
        } else if (courses.length === 1) {
          if (args.posicion === 'primero') {
            fail('Esa comida solo tiene un plato. Para ponerle un primero usa anadir_primer_plato.')
          }
          slot = courses[0].slot
        } else {
          // An empty meal takes the shape the generator would have given it.
          slot = meal === 'lunch' ? 'single' : 'main'
        }
        return withMeal(menu.menu_items, day, meal, item => replaceCourse(item, slot, dish.name))
      })

      return {
        text:
          `Hecho. ${formatDay(saved.menu_items, day)}` +
          warningFor(dish, dishes, parseRules(household.rules), before, day, meal, slot),
      }
    },
  },
  {
    name: 'anadir_primer_plato',
    title: 'Añadir un primer plato',
    description:
      'Añade un primer plato a una comida que solo tiene uno; el que había pasa a ser el segundo. ' +
      'Afecta solo a ese día, no a las reglas de la casa.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: {
        dia: DAY_SCHEMA,
        comida: MEAL_SCHEMA,
        plato: { type: 'string', description: 'Nombre del primer plato, tal como sale en listar_platos.' },
      },
      required: ['dia', 'comida', 'plato'],
    },
    async run(args, ctx) {
      const day = dayArg(args, 'dia')
      const meal = mealArg(args)
      const weekStart = editableWeekOf(day, ctx.today)
      const [dishes, household] = await Promise.all([ctx.store.dishes(), ctx.store.household()])
      const dish = findDish(dishes, textArg(args, 'plato'))

      let before: MenuItem[] = []
      const saved = await editWeek(ctx, weekStart, menu => {
        before = menu.menu_items
        const count = coursesOf(itemOf(menu.menu_items, day, meal)).length
        if (count === 2) fail('Esa comida ya tiene primero y segundo. Para cambiar uno usa cambiar_plato.')
        if (count === 0) fail('Esa comida no tiene ningún plato. Ponle uno con cambiar_plato.')
        return withMeal(menu.menu_items, day, meal, item => addFirstCourse(item, dish.name))
      })

      return {
        text:
          `Hecho. ${formatDay(saved.menu_items, day)}` +
          warningFor(dish, dishes, parseRules(household.rules), before, day, meal, 'starter'),
      }
    },
  },
  {
    name: 'quitar_primer_plato',
    title: 'Quitar el primer plato',
    description:
      'Quita el primer plato de una comida que tiene dos y deja solo el segundo. Afecta solo a ese día.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: { dia: DAY_SCHEMA, comida: MEAL_SCHEMA },
      required: ['dia', 'comida'],
    },
    async run(args, ctx) {
      const day = dayArg(args, 'dia')
      const meal = mealArg(args)
      const weekStart = editableWeekOf(day, ctx.today)
      const saved = await editWeek(ctx, weekStart, menu => {
        if (coursesOf(itemOf(menu.menu_items, day, meal)).length !== 2) {
          fail('Esa comida no tiene primer plato que quitar.')
        }
        return withMeal(menu.menu_items, day, meal, removeFirstCourse)
      })
      return { text: `Hecho. ${formatDay(saved.menu_items, day)}` }
    },
  },
  {
    name: 'intercambiar_dias',
    title: 'Intercambiar dos días',
    description:
      'Intercambia el menú completo de dos días de la misma semana: la comida y la cena viajan juntas. ' +
      'Repetir la misma llamada lo deshace.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: { dia_a: DAY_SCHEMA, dia_b: DAY_SCHEMA },
      required: ['dia_a', 'dia_b'],
    },
    async run(args, ctx) {
      const dayA = dayArg(args, 'dia_a')
      const dayB = dayArg(args, 'dia_b')
      if (dayA === dayB) fail('Son el mismo día.')
      const weekStart = editableWeekOf(dayA, ctx.today)
      if (editableWeekOf(dayB, ctx.today) !== weekStart) {
        fail('Los dos días tienen que ser de la misma semana.')
      }
      const saved = await editWeek(ctx, weekStart, menu => swapDays(menu.menu_items, dayA, dayB))
      return { text: `Hecho.\n${formatDay(saved.menu_items, dayA)}\n${formatDay(saved.menu_items, dayB)}` }
    },
  },
  {
    name: 'generar_menu',
    title: 'Generar el menú de una semana',
    description:
      'Crea el menú de una semana a partir de los platos y las reglas de la casa. Si esa semana ya tiene ' +
      'menú, lo sustituye ENTERO y se pierden los cambios hechos a mano: pide antes confirmación a la ' +
      'persona y solo entonces llama con confirmar_reemplazo en true.',
    readOnly: false,
    destructive: true,
    inputSchema: {
      type: 'object',
      properties: {
        semana: { type: 'string', enum: ['actual', 'siguiente'], description: 'Por defecto, la actual.' },
        confirmar_reemplazo: {
          type: 'boolean',
          description: 'True solo si la persona ha confirmado que quiere sustituir el menú que ya existe.',
        },
      },
    },
    async run(args, ctx) {
      const week = weekArg(args, ['actual', 'siguiente'])
      const weekStart = weekStartFor(WEEKS[week], ctx.today)
      const key = formatLocalDate(weekStart)

      const existing = await ctx.store.menu(key)
      if (existing && args.confirmar_reemplazo !== true) {
        return {
          isError: true,
          text:
            `La semana ${week} ya tiene menú. Generarlo de nuevo lo sustituye entero, incluidos los cambios ` +
            'hechos a mano. Pregunta a la persona y, si confirma, repite la llamada con confirmar_reemplazo en true.',
        }
      }

      const [dishes, household] = await Promise.all([ctx.store.dishes(), ctx.store.household()])
      if (dishes.length === 0) fail('La casa no tiene platos. Hay que añadirlos primero desde la app.')

      const result = generateWeeklyMenu({
        dishIdeas: dishes,
        weekStart,
        rules: parseRules(household.rules),
      })

      let saved: WeeklyMenu
      if (existing) {
        saved = await editWeek(ctx, key, () => result.items)
      } else {
        try {
          saved = await ctx.store.createMenu(key, formatLocalDate(weekEndFor(weekStart)), result.items)
        } catch (error) {
          // The app generates next week by itself the first time someone opens
          // it; losing that race means the week now exists and is theirs.
          if ((error as { code?: string }).code !== '23505') throw error
          return fail('Esa semana acaba de crearse desde la app. Mírala con ver_menu.')
        }
      }

      // Never let a degraded week pass unmentioned (see MenuGenerationResult).
      const degraded = result.degraded ? describeDegradedMenu(result.unmet) : null
      return {
        text:
          `Menú ${existing ? 'regenerado' : 'creado'}.\n\n${formatMenu(saved, ctx.today)}` +
          (degraded ? `\n\nAviso para la persona: ${degraded.title}. ${degraded.detail}` : ''),
      }
    },
  },
]

/**
 * Which week a call was about, for analytics: the one it named, or the one its
 * day falls in. Undefined when the call is not about a week at all.
 */
export const weekOfCall = (args: Record<string, unknown>, today: Date): WeekName | undefined => {
  if (typeof args.semana === 'string' && args.semana in WEEKS) return args.semana as WeekName
  const day = args.dia ?? args.dia_a
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined
  const key = formatLocalDate(getCurrentWeekStart(parseDay(day)))
  return (Object.keys(WEEKS) as WeekName[]).find(name => weekKey(name, today) === key)
}

/** Runs a tool by name. Mistakes the assistant can correct come back as error results, not exceptions. */
export const runTool = async (
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult | null> => {
  const tool = TOOLS.find(t => t.name === name)
  if (!tool) return null
  try {
    return await tool.run(args, ctx)
  } catch (error) {
    if (error instanceof ToolError) return { text: error.message, isError: true }
    throw error
  }
}
