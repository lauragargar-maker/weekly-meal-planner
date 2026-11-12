import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DishIdea,
  Household,
  MenuItem,
  ShoppingList,
  ShoppingListItem,
  WeeklyMenu,
} from '../types'

/**
 * Everything the MCP tools read and write, for one household.
 *
 * The tools talk to this instead of to Supabase so they can be tested against
 * an in-memory household, and so the one rule that matters is written once:
 * every query is scoped to the caller's household. Row Level Security enforces
 * the same thing underneath — the client carries the user's own token, never
 * the service key — so the filter here is the second lock, not the only one.
 */
export interface Store {
  household(): Promise<Household>
  dishes(): Promise<DishIdea[]>
  /** The menu of the week starting on `weekStart` (`YYYY-MM-DD`, a Monday). */
  menu(weekStart: string): Promise<WeeklyMenu | null>
  /**
   * Saves new items on a menu that was just read. Resolves to `null` when the
   * menu changed in between (someone edited it in the app): the caller reads it
   * again and reapplies, rather than overwriting what it never saw.
   */
  saveItems(menu: WeeklyMenu, items: MenuItem[]): Promise<WeeklyMenu | null>
  createMenu(weekStart: string, weekEnd: string, items: MenuItem[]): Promise<WeeklyMenu>
  shoppingList(): Promise<{ list: ShoppingList; items: ShoppingListItem[] } | null>
}

export const supabaseStore = (db: SupabaseClient, householdId: string): Store => ({
  async household() {
    const { data, error } = await db.from('households').select('*').eq('id', householdId).single()
    if (error) throw error
    return data as Household
  },

  async dishes() {
    const { data, error } = await db
      .from('dish_ideas')
      .select('*')
      .eq('household_id', householdId)
      .order('name')
    if (error) throw error
    return (data ?? []) as DishIdea[]
  },

  async menu(weekStart) {
    const { data, error } = await db
      .from('weekly_menus')
      .select('*')
      .eq('household_id', householdId)
      .eq('week_start', weekStart)
      .maybeSingle()
    if (error) throw error
    return (data as WeeklyMenu | null) ?? null
  },

  async saveItems(menu, items) {
    const { data, error } = await db
      .from('weekly_menus')
      .update({ menu_items: items, updated_at: new Date().toISOString() })
      .eq('id', menu.id)
      .eq('household_id', householdId)
      .eq('updated_at', menu.updated_at)
      .select()
    if (error) throw error
    return ((data ?? [])[0] as WeeklyMenu | undefined) ?? null
  },

  async createMenu(weekStart, weekEnd, items) {
    const { data, error } = await db
      .from('weekly_menus')
      .insert({ household_id: householdId, week_start: weekStart, week_end: weekEnd, menu_items: items })
      .select()
      .single()
    if (error) throw error
    return data as WeeklyMenu
  },

  async shoppingList() {
    const { data: list, error } = await db
      .from('shopping_lists')
      .select('*')
      .eq('household_id', householdId)
      .maybeSingle()
    if (error) throw error
    if (!list) return null
    const { data: items, error: itemError } = await db
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', (list as ShoppingList).id)
      .order('created_at')
    if (itemError) throw itemError
    return { list: list as ShoppingList, items: (items ?? []) as ShoppingListItem[] }
  },
})
