import type { SupabaseClient } from '@supabase/supabase-js'
import { DishIngredient, ShoppingIngredient, StoreSection } from '../types'
import { cleanName, toKey } from './nameKey'

/** Most ingredients a dish can have. docs/shopping-list-spec.md §7.2. */
export const MAX_DISH_INGREDIENTS = 30
/** Same limit as the database's CHECK on `ingredients.name`. */
export const INGREDIENT_NAME_MAX_LENGTH = 40

/**
 * One ingredient as the dish editor holds it before saving: an existing row of
 * the household's catalogue (`id` set) or a new one to create. `section` and
 * `is_staple` belong to the household's ingredient, not to the dish, so editing
 * them here changes every dish that uses it.
 */
export interface IngredientDraft {
  id?: string
  name: string
  section: StoreSection
  is_staple: boolean
}

/** A dish's ingredients in the order they were added, resolved against the catalogue. */
export const ingredientsOfDish = (
  dishId: string,
  links: DishIngredient[],
  catalog: ShoppingIngredient[]
): ShoppingIngredient[] => {
  const byId = new Map(catalog.map((ingredient) => [ingredient.id, ingredient]))
  return links
    .filter((link) => link.dish_id === dishId)
    .sort((a, b) => a.position - b.position)
    .map((link) => byId.get(link.ingredient_id))
    .filter((ingredient): ingredient is ShoppingIngredient => Boolean(ingredient))
}

/** Ids of the dishes with at least one ingredient, staples included (spec §3.3). */
export const dishesWithIngredients = (links: DishIngredient[]): Set<string> =>
  new Set(links.map((link) => link.dish_id))

/** Catalogue entries whose name contains `query`, ignoring case and accents. */
export const searchIngredients = (
  query: string,
  catalog: ShoppingIngredient[],
  exclude: Set<string>,
  limit = 6
): ShoppingIngredient[] => {
  const key = toKey(query)
  if (!key) return []
  return catalog
    .filter((ingredient) => !exclude.has(ingredient.name_key) && ingredient.name_key.includes(key))
    // Names that start with what was typed first: "ce" → Cebolla before Lechuga.
    .sort((a, b) => Number(b.name_key.startsWith(key)) - Number(a.name_key.startsWith(key)) || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}

/**
 * Writes a dish's ingredients: creates the new catalogue entries, applies any
 * section or staple change to the existing ones, and replaces the dish's links.
 *
 * Not atomic. A failure halfway leaves the catalogue with the new ingredients
 * but the dish with its old list, which a second save repairs — never a dish
 * pointing at something that does not exist.
 */
export async function saveDishIngredients(
  client: SupabaseClient,
  householdId: string,
  dishId: string,
  drafts: IngredientDraft[],
  catalog: ShoppingIngredient[]
): Promise<void> {
  const byId = new Map(catalog.map((ingredient) => [ingredient.id, ingredient]))

  // 1. Section or staple changed on an ingredient the household already had.
  const changed = drafts.filter((draft) => {
    const current = draft.id ? byId.get(draft.id) : undefined
    return current && (current.section !== draft.section || current.is_staple !== draft.is_staple)
  })
  for (const draft of changed) {
    const { error } = await client
      .from('ingredients')
      .update({ section: draft.section, is_staple: draft.is_staple })
      .eq('id', draft.id!)
      .eq('household_id', householdId)
    if (error) throw error
  }

  // 2. New ingredients. Upserting on the key means one created meanwhile by
  // another member of the household is reused rather than refused.
  const fresh = drafts.filter((draft) => !draft.id)
  const createdIds = new Map<string, string>()
  if (fresh.length > 0) {
    const { data, error } = await client
      .from('ingredients')
      .upsert(
        fresh.map((draft) => ({
          household_id: householdId,
          name: cleanName(draft.name),
          name_key: toKey(draft.name),
          section: draft.section,
          is_staple: draft.is_staple,
        })),
        { onConflict: 'household_id,name_key' }
      )
      .select('id, name_key')
    if (error) throw error
    for (const row of (data ?? []) as { id: string; name_key: string }[]) createdIds.set(row.name_key, row.id)
  }

  // 3. The dish's links, replaced wholesale: the list is short and its order matters.
  const { error: deleteError } = await client
    .from('dish_ingredients')
    .delete()
    .eq('dish_id', dishId)
    .eq('household_id', householdId)
  if (deleteError) throw deleteError

  const rows = drafts
    .map((draft) => draft.id ?? createdIds.get(toKey(draft.name)))
    .filter((id): id is string => Boolean(id))
    .map((ingredientId, position) => ({
      dish_id: dishId,
      ingredient_id: ingredientId,
      household_id: householdId,
      position,
    }))
  if (rows.length === 0) return
  const { error: insertError } = await client.from('dish_ingredients').insert(rows)
  if (insertError) throw insertError
}
