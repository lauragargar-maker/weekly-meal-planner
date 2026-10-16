import {
  DishIdea,
  DishIngredient,
  MenuItem,
  ShoppingIngredient,
  ShoppingList,
  ShoppingListItem,
  ShoppingSource,
  StoreSection,
} from '../types'
import { formatLocalDate } from '../utils/weekStart'
import { dishesWithIngredients, ingredientsOfDish } from './dishIngredients'
import { toKey } from './nameKey'
import { STORE_SECTIONS } from './storeSections'

/**
 * The shopping list's logic, kept free of React and Supabase so it can be
 * tested on its own. docs/shopping-list-spec.md §5.
 *
 * Days are `YYYY-MM-DD` strings in local time throughout, like `MenuItem.day`.
 */

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** How many days the picker marks to start with, from tomorrow (D9). */
export const DEFAULT_DAYS = 5

export const parseDay = (day: string): Date => {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** "Miércoles 14". Parsed as a local date, never through `new Date(string)`, which reads UTC. */
export const longDay = (day: string): string => {
  const date = parseDay(day)
  return `${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()}`
}

/** "mié 14" */
export const shortDay = (day: string): string => {
  const date = parseDay(day)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`
}

/** "mié 14 – dom 18 oct", or "mié 14 oct" for a single day. */
export const formatRange = (days: string[]): string => {
  if (days.length === 0) return ''
  const sorted = [...days].sort()
  const first = parseDay(sorted[0])
  const last = parseDay(sorted[sorted.length - 1])
  const end = `${shortDay(sorted[sorted.length - 1])} ${MONTHS[last.getMonth()]}`
  if (sorted.length === 1) return end
  const start = first.getMonth() === last.getMonth() ? shortDay(sorted[0]) : `${shortDay(sorted[0])} ${MONTHS[first.getMonth()]}`
  return `${start} – ${end}`
}

/**
 * The days the picker offers: from today to the Sunday of next week, which is
 * as far as the week navigation reaches (`WEEK_RANGE.max = 1`). §5.2.
 */
export const selectableDays = (today: Date): string[] => {
  const daysToSunday = (7 - today.getDay()) % 7
  const lastDay = addDays(today, daysToSunday + 7)
  const days: string[] = []
  for (let d = addDays(today, 0); d <= lastDay; d = addDays(d, 1)) days.push(formatLocalDate(d))
  return days
}

/** Tomorrow and the four days after it (D9). Always inside `selectableDays`. */
export const defaultSelection = (today: Date): string[] =>
  Array.from({ length: DEFAULT_DAYS }, (_, i) => formatLocalDate(addDays(today, i + 1)))

/** The dishes of one day's menu items, in the order they are eaten. */
export const dishesOfDay = (items: MenuItem[]): { name: string; meal: MenuItem['meal_type'] }[] =>
  [...items]
    .sort((a, b) => (a.meal_type === b.meal_type ? 0 : a.meal_type === 'lunch' ? -1 : 1))
    .flatMap((item) =>
      [item.starter, item.main, item.single]
        .filter((name): name is string => Boolean(name && name.trim()))
        .map((name) => ({ name, meal: item.meal_type }))
    )

/** Every menu item of the given menus, by day. */
export const menuItemsByDay = (menus: { menu_items: MenuItem[] }[]): Map<string, MenuItem[]> => {
  const byDay = new Map<string, MenuItem[]>()
  for (const menu of menus) {
    for (const item of menu.menu_items) byDay.set(item.day, [...(byDay.get(item.day) ?? []), item])
  }
  return byDay
}

export interface ListDraftItem {
  ingredient_id: string
  name: string
  section: StoreSection
  sources: ShoppingSource[]
}

export interface ListDraft {
  days: string[]
  skippedDays: string[]
  missingDishes: string[]
  items: ListDraftItem[]
}

export interface ListInputs {
  menusByDay: Map<string, MenuItem[]>
  dishes: DishIdea[]
  links: DishIngredient[]
  catalog: ShoppingIngredient[]
}

/**
 * What goes on the list for `days` (§5.4). A day with no dishes is skipped. A
 * menu stores dish names, so each is looked up in Platos by `toKey`; a name
 * that is not there, or a dish with no ingredients, is reported as missing.
 * Staples are left out, and an ingredient shared by several dishes or days is
 * one item with every one of them as a source.
 */
export const buildShoppingList = (days: string[], { menusByDay, dishes, links, catalog }: ListInputs): ListDraft => {
  const dishByKey = new Map(dishes.map((dish) => [toKey(dish.name), dish]))
  const filled = dishesWithIngredients(links)
  const included: string[] = []
  const skipped: string[] = []
  const missing: string[] = []
  const byIngredient = new Map<string, ListDraftItem>()

  for (const day of [...days].sort()) {
    const dayDishes = dishesOfDay(menusByDay.get(day) ?? [])
    if (dayDishes.length === 0) {
      skipped.push(day)
      continue
    }
    included.push(day)
    for (const { name, meal } of dayDishes) {
      const dish = dishByKey.get(toKey(name))
      if (!dish || !filled.has(dish.id)) {
        if (!missing.includes(name)) missing.push(name)
        continue
      }
      for (const ingredient of ingredientsOfDish(dish.id, links, catalog)) {
        if (ingredient.is_staple) continue
        const source = { dish: dish.name, day, meal }
        const existing = byIngredient.get(ingredient.id)
        if (existing) existing.sources.push(source)
        else
          byIngredient.set(ingredient.id, {
            ingredient_id: ingredient.id,
            name: ingredient.name,
            section: ingredient.section,
            sources: [source],
          })
      }
    }
  }

  return { days: included, skippedDays: skipped, missingDishes: missing, items: [...byIngredient.values()] }
}

/** djb2 over the text: short, stable, and plenty to tell two states apart. */
const hash = (text: string): string => {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/**
 * A fingerprint of what the list was built from (§5.7): the dishes planned on
 * each day — the included ones and the skipped ones, so planning a skipped day
 * counts as a change — and the bought ingredients of each dish found. If it
 * differs from the one stored with the list, the menu has changed since.
 */
export const listFingerprint = (days: string[], { menusByDay, dishes, links, catalog }: ListInputs): string => {
  const dishByKey = new Map(dishes.map((dish) => [toKey(dish.name), dish]))
  const parts = [...days].sort().map((day) => {
    const names = dishesOfDay(menusByDay.get(day) ?? []).map(({ name, meal }) => {
      const dish = dishByKey.get(toKey(name))
      const bought = dish
        ? ingredientsOfDish(dish.id, links, catalog)
            .filter((ingredient) => !ingredient.is_staple)
            .map((ingredient) => ingredient.id)
            .sort()
            .join(',')
        : '?'
      return `${meal}:${toKey(name)}[${bought}]`
    })
    return `${day}=${names.join('|')}`
  })
  return hash(parts.join(';'))
}

export type ListStatus = 'active' | 'all_checked' | 'expired'

/**
 * In progress or closed (§5.10, D12). Closed once its last day is behind us,
 * or once it has items and all are ticked. Expired wins: a list from last week
 * stays closed even if someone unticks something on it.
 */
export const listStatus = (
  list: Pick<ShoppingList, 'days'>,
  items: Pick<ShoppingListItem, 'checked'>[],
  today: Date
): ListStatus => {
  const lastDay = [...list.days].sort()[list.days.length - 1]
  if (lastDay && lastDay < formatLocalDate(today)) return 'expired'
  if (items.length > 0 && items.every((item) => item.checked)) return 'all_checked'
  return 'active'
}

/** The fields of a new item row, before it has an id. */
export type NewListItem = Pick<ShoppingListItem, 'ingredient_id' | 'name' | 'section' | 'origin' | 'sources' | 'checked'>

const itemKey = (item: Pick<ShoppingListItem, 'ingredient_id' | 'name'>): string =>
  item.ingredient_id ?? `name:${toKey(item.name)}`

/**
 * The items of a list that replaces `previous` (§5.6).
 * - From a list in progress: what was added by hand stays as it was, and an
 *   item that was ticked stays ticked if it is still needed.
 * - From a closed list: nothing ticked carries over — bought last week is not
 *   bought this week — and only hand-added items left unticked come along.
 */
export const itemsForReplacement = (
  draft: ListDraftItem[],
  previous: Pick<ShoppingListItem, 'ingredient_id' | 'name' | 'section' | 'origin' | 'sources' | 'checked'>[],
  previousStatus: ListStatus | null
): NewListItem[] => {
  const closed = previousStatus !== null && previousStatus !== 'active'
  const tickedBefore = closed ? new Set<string>() : new Set(previous.filter((i) => i.checked).map(itemKey))
  const fromMenu: NewListItem[] = draft.map((item) => ({
    ingredient_id: item.ingredient_id,
    name: item.name,
    section: item.section,
    origin: 'menu',
    sources: item.sources,
    checked: tickedBefore.has(item.ingredient_id),
  }))
  const menuKeys = new Set(fromMenu.map(itemKey))
  const manual: NewListItem[] = previous
    .filter((item) => item.origin === 'manual' && !(closed && item.checked) && !menuKeys.has(itemKey(item)))
    .map((item) => ({
      ingredient_id: item.ingredient_id,
      name: item.name,
      section: item.section,
      origin: 'manual',
      sources: [],
      checked: closed ? false : item.checked,
    }))
  return [...fromMenu, ...manual]
}

/** Pending first, alphabetically; ticked ones after, also alphabetically (§5.5). */
const compareItems = (a: ShoppingListItem, b: ShoppingListItem): number =>
  Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'es')

/** The items grouped by section, in the order the shop is walked. Empty sections are left out. */
export const groupBySection = (items: ShoppingListItem[]) =>
  STORE_SECTIONS.map(({ value, label }) => ({
    section: value,
    label,
    items: items.filter((item) => item.section === value).sort(compareItems),
  })).filter((group) => group.items.length > 0)

/** "Lentejas (mié) · Cocido (vie)", or "Lentejas (mié) y 2 más" past two. */
export const formatSources = (item: Pick<ShoppingListItem, 'origin' | 'sources'>): string => {
  if (item.origin === 'manual') return 'Añadido a mano'
  const parts = item.sources.map((source) => `${source.dish} (${WEEKDAYS[parseDay(source.day).getDay()]})`)
  if (parts.length <= 2) return parts.join(' · ')
  return `${parts[0]} y ${parts.length - 1} más`
}

/** The text Copiar and Compartir hand over (§5.8): pending items only, by section. */
export const formatListText = (list: Pick<ShoppingList, 'days'>, items: ShoppingListItem[]): string => {
  const pending = items.filter((item) => !item.checked)
  const sections = groupBySection(pending).map(
    (group) => `${group.label.toLocaleUpperCase('es')}\n${group.items.map((item) => `- ${item.name}`).join('\n')}`
  )
  return [`🛒 Lista de la compra · ${formatRange(list.days)}`, ...sections].join('\n\n')
}
