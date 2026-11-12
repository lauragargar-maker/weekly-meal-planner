import type { DishIdea, Household, MenuItem, ShoppingList, ShoppingListItem, WeeklyMenu } from '../types'
import { PRODUCTION_CATALOG } from '../utils/__fixtures__/productionCatalog'
import type { Store } from './store'

/** An in-memory household for the MCP tests, behaving like `supabaseStore`. */
export interface MemoryStore extends Store {
  menus: Map<string, WeeklyMenu>
  shopping: { list: ShoppingList; items: ShoppingListItem[] } | null
  /** Runs once, between a tool's read and its save: someone editing in the app. */
  beforeSave: (() => void) | null
}

export const memoryStore = (rules: unknown = {}): MemoryStore => {
  const household: Household = { id: 'h1', name: 'Casa García', join_code: '123456', rules }
  const dishes: DishIdea[] = PRODUCTION_CATALOG.map((dish, i) => ({
    ...dish,
    id: `d${i}`,
    household_id: 'h1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }))
  let revision = 0
  const stamp = () => `rev-${++revision}`

  const store: MemoryStore = {
    menus: new Map(),
    shopping: null,
    beforeSave: null,
    household: async () => household,
    dishes: async () => dishes,
    menu: async weekStart => {
      const menu = store.menus.get(weekStart)
      return menu ? structuredClone(menu) : null
    },
    saveItems: async (menu, items) => {
      const interfere = store.beforeSave
      store.beforeSave = null
      interfere?.()
      const current = store.menus.get(menu.week_start)
      if (!current || current.updated_at !== menu.updated_at) return null
      const saved = { ...current, menu_items: items, updated_at: stamp() }
      store.menus.set(menu.week_start, saved)
      return structuredClone(saved)
    },
    createMenu: async (weekStart, weekEnd, items) => {
      if (store.menus.has(weekStart)) throw Object.assign(new Error('duplicate'), { code: '23505' })
      const menu: WeeklyMenu = {
        id: `m-${weekStart}`,
        household_id: 'h1',
        week_start: weekStart,
        week_end: weekEnd,
        menu_items: items,
        created_at: stamp(),
        updated_at: stamp(),
      }
      store.menus.set(weekStart, menu)
      return structuredClone(menu)
    },
    shoppingList: async () => store.shopping,
  }
  return store
}

/** Puts a hand-written week in the store, bypassing the generator. */
export const seedMenu = (store: MemoryStore, weekStart: string, items: MenuItem[]): void => {
  store.menus.set(weekStart, {
    id: `m-${weekStart}`,
    household_id: 'h1',
    week_start: weekStart,
    week_end: weekStart,
    menu_items: items,
    created_at: 'seed',
    updated_at: 'seed',
  })
}
